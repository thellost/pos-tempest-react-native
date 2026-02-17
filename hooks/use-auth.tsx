import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { powersync } from '@/db/provider';
import { supabase } from '@/lib/supabase';

const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

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
  const [idleTimeoutMs, setIdleTimeoutMs] = useState(DEFAULT_IDLE_TIMEOUT_MS);
  const lastActivityRef = useRef(Date.now());

  const refreshProfile = useCallback(async () => {
    const authUserId = session?.user?.id;

    if (!authUserId) {
      setUser(null);
      return;
    }

    const profile = await fetchUserProfile(authUserId);
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
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        throw error;
      }

      markActivity();
      setIsLocked(false);
    },
    [markActivity],
  );

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    setUser(null);
    setSession(null);
    setIsLocked(false);
  }, []);

  const unlockWithPin = useCallback(
    async (pin: string) => {
      const authUserId = session?.user?.id;

      if (!authUserId) {
        return false;
      }

      const result = await powersync.getOptional<{ id: number }>(
        `
          SELECT id
          FROM users
          WHERE supabase_auth_id = ?
            AND pin_code = ?
            AND is_active = 1
          LIMIT 1
        `,
        [authUserId, pin],
      );

      const valid = Boolean(result);
      if (valid) {
        setIsLocked(false);
        markActivity();
      }

      return valid;
    },
    [markActivity, session?.user?.id],
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

    const appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') {
        setIsLocked(true);
      } else {
        markActivity();
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
    };
  }, [idleTimeoutMs, isLocked, markActivity, session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      session,
      authUser: session?.user ?? null,
      user,
      isAuthenticated: Boolean(session),
      isLocked,
      idleTimeoutMs,
      setIdleTimeoutMs,
      signIn,
      signOut,
      unlockWithPin,
      lock,
      markActivity,
      refreshProfile,
    }),
    [idleTimeoutMs, isLocked, loading, lock, markActivity, refreshProfile, session, signIn, signOut, unlockWithPin, user],
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
