import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { Config } from '@/constants/config';
import { powersync } from '@/db/provider';
import {
  AuditEventType,
  getSafeErrorMessage,
  logAuditEvent,
  loginRateLimiter,
  pinRateLimiter,
  sanitizeInput,
  validateEmail,
  validatePinFormat,
  validateSession,
  verifyPin,
} from '@/lib/security';
import { supabase } from '@/lib/supabase';

type UserRow = {
  id: number;
  role_id: number;
  branch_id: number;
  supabase_auth_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  pin_code: string | null;
  avatar_url: string | null;
  is_active: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  role_name: string;
};

type AuthContextValue = {
  loading: boolean;
  session: Session | null;
  authUser: SupabaseUser | null;
  user: UserRow | null;
  isAuthenticated: boolean;
  isLocked: boolean;
  idleTimeoutMs: number;
  loginAttempts: number;
  pinAttempts: number;
  isLoginLocked: boolean;
  isPinLocked: boolean;
  loginResetInMs: number;
  pinResetInMs: number;
  setIdleTimeoutMs: (value: number) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  unlockWithPin: (pin: string) => Promise<boolean>;
  lock: () => void;
  markActivity: () => void;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchUserProfile(supabaseAuthId?: string): Promise<UserRow | null> {
  if (!supabaseAuthId) {
    return null;
  }

  return powersync.getOptional<UserRow>(
    `
      SELECT
        u.*,
        r.name AS role_name
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      WHERE u.supabase_auth_id = ?
      LIMIT 1
    `,
    [supabaseAuthId],
  );
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserRow | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [idleTimeoutMs, setIdleTimeoutMs] = useState(Config.IDLE_TIMEOUT_MS);
  const [sessionLoginTime, setSessionLoginTime] = useState<number | null>(null);
  const lastActivityRef = useRef(Date.now());
  
  // Rate limiting state
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [pinAttempts, setPinAttempts] = useState(0);
  const [isLoginLocked, setIsLoginLocked] = useState(false);
  const [isPinLocked, setIsPinLocked] = useState(false);
  const [loginResetInMs, setLoginResetInMs] = useState(0);
  const [pinResetInMs, setPinResetInMs] = useState(0);

  const refreshProfile = useCallback(async () => {
    const authUserId = session?.user?.id;

    if (!authUserId) {
      setUser(null);
      return;
    }

    const profile = await fetchUserProfile(authUserId);
    
    // Security: Validate user is active
    if (profile && !profile.is_active) {
      await signOut();
      throw new Error('Account is inactive. Please contact administrator.');
    }
    
    // Update last login timestamp
    if (profile) {
      await powersync.execute(
        'UPDATE users SET last_login_at = ? WHERE id = ?',
        [new Date().toISOString(), profile.id],
      );
    }
    
    setUser(profile);
  }, [session?.user?.id]);

  const lock = useCallback(() => {
    setIsLocked(true);
  }, []);

  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      // Input validation
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      const sanitizedEmail = sanitizeInput(email);
      
      if (!validateEmail(sanitizedEmail)) {
        throw new Error('Invalid email format');
      }

      // Rate limiting check
      const rateLimitCheck = loginRateLimiter.check(sanitizedEmail);
      
      setLoginAttempts(rateLimitCheck.remainingAttempts);
      setIsLoginLocked(rateLimitCheck.isLocked);
      setLoginResetInMs(rateLimitCheck.resetInMs);

      if (!rateLimitCheck.allowed) {
        const minutes = Math.ceil(rateLimitCheck.resetInMs / 60000);
        logAuditEvent({
          type: AuditEventType.ACCOUNT_LOCKED,
          metadata: { email: sanitizedEmail, reason: 'Too many login attempts' },
          timestamp: Date.now(),
        });
        throw new Error(`Too many login attempts. Please try again in ${minutes} minutes.`);
      }

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: sanitizedEmail,
          password: password,
        });

        if (error) {
          // Record failed attempt
          loginRateLimiter.recordAttempt(sanitizedEmail);
          const updatedCheck = loginRateLimiter.check(sanitizedEmail);
          setLoginAttempts(updatedCheck.remainingAttempts);
          
          logAuditEvent({
            type: AuditEventType.LOGIN_FAILED,
            metadata: { email: sanitizedEmail, error: error.message },
            timestamp: Date.now(),
          });

          throw new Error(getSafeErrorMessage(error));
        }

        // Validate session
        if (!data.session) {
          throw new Error('Failed to establish session');
        }

        const sessionValidation = validateSession(data.session.expires_at);
        if (!sessionValidation.valid) {
          throw new Error(sessionValidation.reason || 'Invalid session');
        }

        // Success - reset rate limiter
        loginRateLimiter.reset(sanitizedEmail);
        setLoginAttempts(0);
        setIsLoginLocked(false);
        setLoginResetInMs(0);
        setSessionLoginTime(Date.now());

        logAuditEvent({
          type: AuditEventType.LOGIN_SUCCESS,
          userId: data.session.user.id,
          timestamp: Date.now(),
        });

        markActivity();
        setIsLocked(false);
      } catch (error) {
        // Update rate limiting state even on errors
        const updatedCheck = loginRateLimiter.check(sanitizedEmail);
        setLoginAttempts(updatedCheck.remainingAttempts);
        setIsLoginLocked(updatedCheck.isLocked);
        setLoginResetInMs(updatedCheck.resetInMs);
        throw error;
      }
    },
    [markActivity],
  );

  const signOut = useCallback(async () => {
    const userId = session?.user?.id;
    
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    logAuditEvent({
      type: AuditEventType.LOGOUT,
      userId,
      timestamp: Date.now(),
    });

    setUser(null);
    setSession(null);
    setIsLocked(false);
    setSessionLoginTime(null);
    
    // Reset rate limiting
    setLoginAttempts(0);
    setPinAttempts(0);
    setIsLoginLocked(false);
    setIsPinLocked(false);
  }, [session?.user?.id]);

  const unlockWithPin = useCallback(
    async (pin: string) => {
      const authUserId = session?.user?.id;
      const userEmail = session?.user?.email || 'unknown';

      if (!authUserId) {
        return false;
      }

      // Input validation
      if (!validatePinFormat(pin)) {
        logAuditEvent({
          type: AuditEventType.PIN_UNLOCK_FAILED,
          userId: authUserId,
          metadata: { reason: 'Invalid PIN format' },
          timestamp: Date.now(),
        });
        return false;
      }

      // Rate limiting check
      const rateLimitCheck = pinRateLimiter.check(authUserId);
      
      setPinAttempts(rateLimitCheck.remainingAttempts);
      setIsPinLocked(rateLimitCheck.isLocked);
      setPinResetInMs(rateLimitCheck.resetInMs);

      if (!rateLimitCheck.allowed) {
        const minutes = Math.ceil(rateLimitCheck.resetInMs / 60000);
        logAuditEvent({
          type: AuditEventType.ACCOUNT_LOCKED,
          userId: authUserId,
          metadata: { reason: `Too many PIN attempts. Locked for ${minutes} minutes` },
          timestamp: Date.now(),
        });
        return false;
      }

      try {
        // Fetch user with PIN from database
        const userWithPin = await powersync.getOptional<{
          id: number;
          pin_code: string | null;
          is_active: number;
        }>(
          `
            SELECT id, pin_code, is_active
            FROM users
            WHERE supabase_auth_id = ?
            LIMIT 1
          `,
          [authUserId],
        );

        // Security checks
        if (!userWithPin) {
          pinRateLimiter.recordAttempt(authUserId);
          logAuditEvent({
            type: AuditEventType.PIN_UNLOCK_FAILED,
            userId: authUserId,
            metadata: { reason: 'User not found' },
            timestamp: Date.now(),
          });
          return false;
        }

        if (!userWithPin.is_active) {
          logAuditEvent({
            type: AuditEventType.PIN_UNLOCK_FAILED,
            userId: authUserId,
            metadata: { reason: 'User inactive' },
            timestamp: Date.now(),
          });
          return false;
        }

        if (!userWithPin.pin_code) {
          logAuditEvent({
            type: AuditEventType.PIN_UNLOCK_FAILED,
            userId: authUserId,
            metadata: { reason: 'No PIN set' },
            timestamp: Date.now(),
          });
          return false;
        }

        // Verify PIN (using constant-time comparison via verifyPin)
        const valid = await verifyPin(pin, userWithPin.pin_code);

        if (!valid) {
          // Record failed attempt
          pinRateLimiter.recordAttempt(authUserId);
          const updatedCheck = pinRateLimiter.check(authUserId);
          setPinAttempts(updatedCheck.remainingAttempts);
          
          logAuditEvent({
            type: AuditEventType.PIN_UNLOCK_FAILED,
            userId: authUserId,
            metadata: { 
              remainingAttempts: updatedCheck.remainingAttempts,
              isLocked: updatedCheck.isLocked,
            },
            timestamp: Date.now(),
          });
          
          return false;
        }

        // Success - reset rate limiter
        pinRateLimiter.reset(authUserId);
        setPinAttempts(0);
        setIsPinLocked(false);
        setPinResetInMs(0);
        
        setIsLocked(false);
        markActivity();

        logAuditEvent({
          type: AuditEventType.PIN_UNLOCK_SUCCESS,
          userId: authUserId,
          timestamp: Date.now(),
        });

        return true;
      } catch (error) {
        // Record attempt even on errors
        pinRateLimiter.recordAttempt(authUserId);
        const updatedCheck = pinRateLimiter.check(authUserId);
        setPinAttempts(updatedCheck.remainingAttempts);
        setIsPinLocked(updatedCheck.isLocked);
        setPinResetInMs(updatedCheck.resetInMs);
        
        logAuditEvent({
          type: AuditEventType.PIN_UNLOCK_FAILED,
          userId: authUserId,
          metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
          timestamp: Date.now(),
        });
        
        return false;
      }
    },
    [markActivity, session?.user?.id, session?.user?.email],
  );

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) {
        return;
      }

      setSession(data.session ?? null);
      setIsLocked(false);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLocked(false);
      lastActivityRef.current = Date.now();
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    refreshProfile().catch(() => {
      setUser(null);
    });
  }, [refreshProfile]);

  useEffect(() => {
    if (!session) {
      return;
    }

    // Check session expiration and maximum session duration
    const checkSessionValidity = () => {
      const sessionValidation = validateSession(session.expires_at);
      
      if (!sessionValidation.valid) {
        logAuditEvent({
          type: AuditEventType.SESSION_EXPIRED,
          userId: session.user.id,
          metadata: { reason: sessionValidation.reason },
          timestamp: Date.now(),
        });
        signOut();
        return;
      }

      // Check max session duration (force re-login after X hours)
      if (sessionLoginTime) {
        const sessionDurationMs = Date.now() - sessionLoginTime;
        const maxSessionMs = Config.MAX_SESSION_DURATION_HOURS * 60 * 60 * 1000;
        
        if (sessionDurationMs > maxSessionMs) {
          logAuditEvent({
            type: AuditEventType.SESSION_EXPIRED,
            userId: session.user.id,
            metadata: { reason: 'Maximum session duration exceeded' },
            timestamp: Date.now(),
          });
          signOut();
          return;
        }
      }
    };

    // Check immediately and then every minute
    checkSessionValidity();
    const sessionCheckInterval = setInterval(checkSessionValidity, Config.SESSION_CHECK_INTERVAL_MS);

    const appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') {
        setIsLocked(true);
      } else {
        markActivity();
        checkSessionValidity();
      }
    });

    const intervalId = setInterval(() => {
      if (isLocked || !session) {
        return;
      }

      const inactiveForMs = Date.now() - lastActivityRef.current;
      if (inactiveForMs >= idleTimeoutMs) {
        setIsLocked(true);
      }
    }, 1000);

    return () => {
      appStateSubscription.remove();
      clearInterval(intervalId);
      clearInterval(sessionCheckInterval);
    };
  }, [idleTimeoutMs, isLocked, markActivity, session, sessionLoginTime, signOut]);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      session,
      authUser: session?.user ?? null,
      user,
      isAuthenticated: Boolean(session),
      isLocked,
      idleTimeoutMs,
      loginAttempts,
      pinAttempts,
      isLoginLocked,
      isPinLocked,
      loginResetInMs,
      pinResetInMs,
      setIdleTimeoutMs,
      signIn,
      signOut,
      unlockWithPin,
      lock,
      markActivity,
      refreshProfile,
    }),
    [
      idleTimeoutMs,
      isLocked,
      loading,
      lock,
      markActivity,
      refreshProfile,
      session,
      signIn,
      signOut,
      unlockWithPin,
      user,
      loginAttempts,
      pinAttempts,
      isLoginLocked,
      isPinLocked,
      loginResetInMs,
      pinResetInMs,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
