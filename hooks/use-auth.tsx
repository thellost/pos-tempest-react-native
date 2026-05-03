import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { Config } from '@/constants/config';
import { getPowerSyncStatusSnapshot, powersync } from '@/db/provider';
import {
  AuditEventType,
  getSafeErrorMessage,
  isCredentialError,
  logAuditEvent,
  loginRateLimiter,
  pinRateLimiter,
  sanitizeInput,
  validateEmail,
  validatePinFormat,
  validateSession,
  verifyPin,
} from '@/lib/security';
import { addBreadcrumb, captureError, clearUserContext, setUserContext, startSpan } from '@/lib/sentry';
import { supabase } from '@/lib/supabase';
import { setAuditUserContext } from '@/services/audit.service';
import { useConfig } from '@/hooks/use-config';

export type UserRow = {
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
  profileLoading: boolean;
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
  unlockWithPin: (pin: string) => Promise<{
    success: boolean;
    isLocked: boolean;
    remainingAttempts: number;
    resetInMs: number;
  }>;
  lock: () => void;
  markActivity: () => void;
  refreshProfile: () => Promise<void>;
};

const AUTH_LOADING_SENTINEL: AuthContextValue = {
  loading: true,
  profileLoading: false,
  session: null,
  authUser: null,
  user: null,
  isAuthenticated: false,
  isLocked: false,
  idleTimeoutMs: 0,
  loginAttempts: 0,
  pinAttempts: 0,
  isLoginLocked: false,
  isPinLocked: false,
  loginResetInMs: 0,
  pinResetInMs: 0,
  setIdleTimeoutMs: () => {},
  signIn: () => Promise.resolve(),
  signOut: () => Promise.resolve(),
  unlockWithPin: () => Promise.resolve({ success: false, isLocked: false, remainingAttempts: 0, resetInMs: 0 }),
  lock: () => {},
  markActivity: () => {},
  refreshProfile: () => Promise.resolve(),
};

const AuthContext = createContext<AuthContextValue>(AUTH_LOADING_SENTINEL);

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

const PROFILE_FETCH_MAX_RETRIES = Config.PROFILE_FETCH_MAX_RETRIES;
const PROFILE_FETCH_INITIAL_DELAY_MS = Config.PROFILE_FETCH_INITIAL_DELAY_MS;

export function AuthProvider({ children }: PropsWithChildren) {
  const { config } = useConfig();
  const pinLockEnabled = config.PIN_LOCK_ENABLED !== 0;
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserRow | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [idleTimeoutMs, setIdleTimeoutMs] = useState(Config.IDLE_TIMEOUT_MS);
  const [sessionLoginTime, setSessionLoginTime] = useState<number | null>(null);
  const lastActivityRef = useRef(Date.now());

  // Auto-unlock immediately whenever PIN lock is disabled
  useEffect(() => {
    if (!pinLockEnabled) setIsLocked(false);
  }, [pinLockEnabled]);
  
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

    setProfileLoading(true);
    console.log('[AuthProvider] Refresh profile start', {
      authUserId,
      powerSync: getPowerSyncStatusSnapshot(),
    });

    try {
      // On fresh install, PowerSync may not have synced the users table yet.
      // Retry with exponential backoff to wait for the initial sync to complete.
      let profile: UserRow | null = null;
      let delay: number = PROFILE_FETCH_INITIAL_DELAY_MS;

      for (let attempt = 0; attempt <= PROFILE_FETCH_MAX_RETRIES; attempt++) {
        profile = await fetchUserProfile(authUserId);

        if (profile) {
          break;
        }

        if (attempt < PROFILE_FETCH_MAX_RETRIES) {
          console.log(
            `[AuthProvider] User profile not found yet (attempt ${attempt + 1}/${PROFILE_FETCH_MAX_RETRIES}). ` +
            `Waiting ${delay}ms for PowerSync sync...`
          );
          await new Promise<void>((resolve) => setTimeout(resolve, delay));
          // Exponential backoff capped at 4 seconds
          delay = Math.min(delay * 2, Config.PROFILE_FETCH_MAX_DELAY_MS);
        }
      }

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

      setAuditUserContext(profile?.id ?? null, profile?.branch_id ?? null);
      if (profile) {
        setUserContext(profile);
      } else {
        clearUserContext();
      }
      setUser(profile);
      console.log('[AuthProvider] Refresh profile result', {
        authUserId,
        found: Boolean(profile),
        branchId: profile?.branch_id ?? null,
        powerSync: getPowerSyncStatusSnapshot(),
      });
    } finally {
      setProfileLoading(false);
    }
  }, [session?.user?.id]);

  const lock = useCallback(() => {
    if (!pinLockEnabled) return;
    addBreadcrumb('auth', 'Screen locked (idle)');
    setIsLocked(true);
  }, [pinLockEnabled]);

  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      return startSpan({ name: 'auth.login', op: 'function' }, async () => {
      // Input validation
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      const sanitizedEmail = sanitizeInput(email);
      
      if (!validateEmail(sanitizedEmail)) {
        throw new Error('Invalid email format');
      }

      // Best-effort local rate limiting (PowerSync may not have synced this user yet)
      const userRow = await powersync.getOptional<{ id: number; retry_attempts: number }>(
        'SELECT id, retry_attempts FROM users WHERE email = ? LIMIT 1',
        [sanitizedEmail],
      );

      if (userRow) {
        const rateLimitCheck = await loginRateLimiter.check(userRow.id, powersync);

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
          addBreadcrumb('auth', 'Account locked (rate limit)', { email: sanitizedEmail }, 'warning');
          throw new Error(`Too many login attempts. Please try again in ${minutes} minutes.`);
        }
      }

      addBreadcrumb('auth', 'Login attempt', { email: sanitizedEmail });
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: sanitizedEmail,
          password: password,
        });

        if (error) {
          console.warn('[auth] signInWithPassword raw error', {
            message: error.message,
            status: error.status,
            code: (error as any).code,
          });
          // Only count the attempt when credentials are wrong — not for network/timeout errors
          if (userRow && isCredentialError(error)) {
            await loginRateLimiter.recordAttempt(userRow.id, powersync);
            const updatedCheck = await loginRateLimiter.check(userRow.id, powersync);
            setLoginAttempts(updatedCheck.remainingAttempts);
            setIsLoginLocked(updatedCheck.isLocked);
            setLoginResetInMs(updatedCheck.resetInMs);
          }
          
          logAuditEvent({
            type: AuditEventType.LOGIN_FAILED,
            metadata: { email: sanitizedEmail, error: error.message },
            timestamp: Date.now(),
          });
          addBreadcrumb('auth', 'Login failed', { email: sanitizedEmail }, 'warning');
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

        // Success - reset local rate limiter if user exists locally
        if (userRow) {
          await loginRateLimiter.reset(userRow.id, powersync);
        }
        setLoginAttempts(0);
        setIsLoginLocked(false);
        setLoginResetInMs(0);
        setSessionLoginTime(Date.now());

        logAuditEvent({
          type: AuditEventType.LOGIN_SUCCESS,
          userId: data.session.user.id,
          timestamp: Date.now(),
        });
        addBreadcrumb('auth', 'Login success', { email: sanitizedEmail });
        markActivity();
        setIsLocked(false);
      } catch (error) {
        // Raw TypeError from the fetch layer (no network connection)
        if (error instanceof TypeError) {
          captureError(error, {
            module: 'auth',
            operation: 'signIn.networkError',
            level: 'warning',
            extras: { email: sanitizeInput(email) },
          });
          throw new Error('Network error. Please check your connection');
        }
        // Any other unexpected error — capture full details to Sentry
        captureError(error, {
          module: 'auth',
          operation: 'signIn.unexpectedError',
          level: 'error',
          extras: {
            email: sanitizeInput(email),
            errorType: error instanceof Error ? error.constructor.name : typeof error,
          },
        });
        throw error;
      }
      }); // end auth.login span
    },
    [markActivity],
  );

  const signOut = useCallback(async () => {
    const userId = session?.user?.id;
    addBreadcrumb('auth', 'Logout', { userId });
    const { error } = await supabase.auth.signOut();

    logAuditEvent({
      type: AuditEventType.LOGOUT,
      userId,
      timestamp: Date.now(),
    });

    setAuditUserContext(null, null);
    clearUserContext();

    if (error) {
      throw error;
    }

    

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

      if (!authUserId) {
        return {
          success: false,
          isLocked: isPinLocked,
          remainingAttempts: pinAttempts,
          resetInMs: pinResetInMs,
        };
      }
      
      // Input validation
      if (!validatePinFormat(pin)) {
        logAuditEvent({
          type: AuditEventType.PIN_UNLOCK_FAILED,
          userId: authUserId,
          metadata: { reason: 'Invalid PIN format' },
          timestamp: Date.now(),
        });
        return {
          success: false,
          isLocked: isPinLocked,
          remainingAttempts: pinAttempts,
          resetInMs: pinResetInMs,
        };
      }

      addBreadcrumb('auth', 'PIN unlock attempt');
      try {
        // Fetch user with PIN from database
        const userWithPin = await powersync.getOptional<{
          id: number;
          pin_code: string | null;
          is_active: number;
          retry_attempts: number;
        }>(
          `
            SELECT id, pin_code, is_active, retry_attempts
            FROM users
            WHERE supabase_auth_id = ?
            LIMIT 1
          `,
          [authUserId],
        );

        // Security checks
        if (!userWithPin) {
          // If PowerSync is re-syncing after a long idle (full checkpoint clear),
          // the users table is temporarily empty. Detect this and prompt the user
          // to wait rather than treating it as a wrong PIN.
          const isSyncing = !powersync.currentStatus.hasSynced || !!powersync.currentStatus.dataFlowStatus?.downloading;
          if (isSyncing) {
            return {
              success: false,
              isLocked: true,
              remainingAttempts: -1, // sentinel: means "syncing, not a failed attempt"
              resetInMs: 0,
            };
          }
          logAuditEvent({
            type: AuditEventType.PIN_UNLOCK_FAILED,
            userId: authUserId,
            metadata: { reason: 'User not found' },
            timestamp: Date.now(),
          });
          return {
            success: false,
            isLocked: false,
            remainingAttempts: 0,
            resetInMs: 0,
          };
        }

        // Rate limiting check (DB-backed)
        const rateLimitCheck = await pinRateLimiter.check(userWithPin.id, powersync);
        
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
          return {
            success: false,
            isLocked: rateLimitCheck.isLocked,
            remainingAttempts: rateLimitCheck.remainingAttempts,
            resetInMs: rateLimitCheck.resetInMs,
          };
        }

        if (!userWithPin.is_active) {
          logAuditEvent({
            type: AuditEventType.PIN_UNLOCK_FAILED,
            userId: authUserId,
            metadata: { reason: 'User inactive' },
            timestamp: Date.now(),
          });
          return {
            success: false,
            isLocked: rateLimitCheck.isLocked,
            remainingAttempts: rateLimitCheck.remainingAttempts,
            resetInMs: rateLimitCheck.resetInMs,
          };
        }

        if (!userWithPin.pin_code) {
          logAuditEvent({
            type: AuditEventType.PIN_UNLOCK_FAILED,
            userId: authUserId,
            metadata: { reason: 'No PIN set' },
            timestamp: Date.now(),
          });
          return {
            success: false,
            isLocked: rateLimitCheck.isLocked,
            remainingAttempts: rateLimitCheck.remainingAttempts,
            resetInMs: rateLimitCheck.resetInMs,
          };
        }

        // Verify PIN (using constant-time comparison via verifyPin)
        const valid = await verifyPin(pin, userWithPin.pin_code);

        if (!valid) {
          // Record failed attempt (DB-backed)
          await pinRateLimiter.recordAttempt(userWithPin.id, powersync);
          const updatedCheck = await pinRateLimiter.check(userWithPin.id, powersync);
          setPinAttempts(updatedCheck.remainingAttempts);
          setIsPinLocked(updatedCheck.isLocked);
          setPinResetInMs(updatedCheck.resetInMs);
          
          logAuditEvent({
            type: AuditEventType.PIN_UNLOCK_FAILED,
            userId: authUserId,
            metadata: { 
              remainingAttempts: updatedCheck.remainingAttempts,
              isLocked: updatedCheck.isLocked,
            },
            timestamp: Date.now(),
          });
          
          return {
            success: false,
            isLocked: updatedCheck.isLocked,
            remainingAttempts: updatedCheck.remainingAttempts,
            resetInMs: updatedCheck.resetInMs,
          };
        }

        // Success - reset rate limiter (DB-backed)
        await pinRateLimiter.reset(userWithPin.id, powersync);
        setPinAttempts(0);
        setIsPinLocked(false);
        setPinResetInMs(0);
        
        setIsLocked(false);
        markActivity();
        addBreadcrumb('auth', 'PIN unlock success');
        logAuditEvent({
          type: AuditEventType.PIN_UNLOCK_SUCCESS,
          userId: authUserId,
          timestamp: Date.now(),
        });

        return {
          success: true,
          isLocked: false,
          remainingAttempts: 0,
          resetInMs: 0,
        };
      } catch (error) {
        captureError(error, { module: 'auth', operation: 'unlockWithPin', level: 'error' });
        logAuditEvent({
          type: AuditEventType.PIN_UNLOCK_FAILED,
          userId: authUserId,
          metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
          timestamp: Date.now(),
        });

        return {
          success: false,
          isLocked: isPinLocked,
          remainingAttempts: pinAttempts,
          resetInMs: pinResetInMs,
        };
      }
    },
    [markActivity, session?.user?.id, session?.user?.email],
  );

  useEffect(() => {
    let mounted = true;

    console.log('[AuthProvider] Restoring session');
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) {
        return;
      }

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('refresh token not found') || msg.includes('invalid refresh token')) {
          console.warn('[AuthProvider] Stale refresh token — clearing session');
          supabase.auth.signOut();
        } else {
          captureError(error, { module: 'auth', operation: 'getSession' });
        }
        setSession(null);
        setLoading(false);
        return;
      }

      setSession(data.session ?? null);
      setIsLocked(false);
      setLoading(false);
      console.log('[AuthProvider] Session restored', {
        hasSession: Boolean(data.session),
        userId: data.session?.user?.id ?? null,
        expiresAt: data.session?.expires_at ?? null,
      });
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      console.log('[AuthProvider] Auth state change', {
        event,
        hasSession: Boolean(nextSession),
        userId: nextSession?.user?.id ?? null,
        expiresAt: nextSession?.expires_at ?? null,
      });

      if (event === 'TOKEN_REFRESHED' && !nextSession) {
        console.warn('[AuthProvider] Token refresh failed — signing out');
        supabase.auth.signOut();
        return;
      }

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
        addBreadcrumb('auth', 'Session expired', { reason: sessionValidation.reason ?? 'unknown' }, 'warning');
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
          addBreadcrumb('auth', 'Session expired', { reason: 'Maximum session duration exceeded' }, 'warning');
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
        if (pinLockEnabled) setIsLocked(true);
      } else {
        markActivity();
        checkSessionValidity();
      }
    });

    const intervalId = setInterval(() => {
      if (!pinLockEnabled || isLocked || !session) {
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
  }, [idleTimeoutMs, isLocked, pinLockEnabled, markActivity, session, sessionLoginTime, signOut]);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      profileLoading,
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
      profileLoading,
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
  return useContext(AuthContext);
}
