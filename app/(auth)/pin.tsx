import { Brand } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

/**
 * Secure PIN unlock screen for quick re-authentication.
 * Features:
 * - Rate limiting with progressive lockout
 * - Attempt tracking with visual feedback
 * - Auto-lockout after max failed attempts
 * - Secure PIN validation
 * - Emergency sign-out option
 */
export default function PinScreen() {
  const { 
    authUser, 
    isAuthenticated, 
    unlockWithPin, 
    signOut,
    pinAttempts,
    isPinLocked,
    pinResetInMs,
  } = useAuth();
  
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lockTimeRemaining, setLockTimeRemaining] = useState(0);

  const maskedPin = useMemo(() => '•'.repeat(pin.length), [pin]);

  // Update lock timer
  useEffect(() => {
    if (isPinLocked && pinResetInMs > 0) {
      setLockTimeRemaining(Math.ceil(pinResetInMs / 1000));
      
      const interval = setInterval(() => {
        setLockTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isPinLocked, pinResetInMs]);

  // Clear error after 3 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  async function submitPin(candidate: string) {
    if (candidate.length !== 6 || loading) {
      return;
    }

    if (isPinLocked) {
      const minutes = Math.ceil(lockTimeRemaining / 60);
      setError(`Locked. Try again in ${minutes} min`);
      setPin('');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const result = await unlockWithPin(candidate);

      if (!result.success) {
        // Use fresh state from the returned object, not stale hook values
        if (result.isLocked) {
          const minutes = Math.ceil(result.resetInMs / 60000);
          setError(`Too many attempts. Locked for ${minutes} minutes.`);
        } else if (result.remainingAttempts > 0) {
          setError(`Wrong PIN. ${result.remainingAttempts} ${result.remainingAttempts === 1 ? 'attempt' : 'attempts'} left.`);
        } else {
          setError('Wrong PIN. Try again.');
        }
        setPin('');
        return;
      }

      // Success - navigation handled by auth layout
      setError(null);
      setPin('');
      router.replace('/(app)/floor');
    } finally {
      setLoading(false);
    }
  }

  function onDigitPress(digit: string) {
    if (loading || pin.length >= 6 || isPinLocked) {
      return;
    }

    setError(null); // Clear error on new input
    const nextPin = `${pin}${digit}`;
    setPin(nextPin);

    // Auto-submit when 6 digits entered
    if (nextPin.length === 6) {
      submitPin(nextPin);
    }
  }

  function onBackspace() {
    if (loading || pin.length === 0) {
      return;
    }

    setError(null);
    setPin(pin.slice(0, -1));
  }

  function onClear() {
    if (loading) {
      return;
    }

    setError(null);
    setPin('');
  }

  async function onSignOut() {
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (err) {
      setError('Sign out failed. Try again.');
    }
  }
  const formatLockTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${secs}s`;
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

  return (
    <View className="flex-1 items-center justify-center bg-surface px-6">
      <View className="w-full max-w-md rounded-2xl border border-white/10 bg-surface-soft p-6">
        {/* Header */}
        <Text className="text-center text-pos-2xl font-bold text-pos-text-strong">
          🔐 Enter PIN
        </Text>
        <Text className="mt-2 text-center text-pos-sm text-pos-muted">
          {authUser?.email ?? 'Locked session'}
        </Text>

        {/* Lock Warning */}
        {isPinLocked && lockTimeRemaining > 0 && (
          <View className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <Text className="text-center text-pos-sm font-semibold text-red-400">
              Too many failed attempts
            </Text>
            <Text className="mt-1 text-center text-pos-base font-bold text-red-300">
              Locked for {formatLockTime(lockTimeRemaining)}
            </Text>
          </View>
        )}

        {/* Attempts Warning */}
        {!isPinLocked && pinAttempts > 0 && pinAttempts <= 2 && (
          <View className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
            <Text className="text-center text-pos-sm text-yellow-400">
              ⚠️ {pinAttempts} {pinAttempts === 1 ? 'attempt' : 'attempts'} remaining
            </Text>
          </View>
        )}

        {/* PIN Display */}
        <View className={`mt-6 rounded-lg border px-4 py-3 ${
          isPinLocked 
            ? 'border-red-500/30 bg-red-500/5' 
            : error 
            ? 'border-yellow-500/30 bg-yellow-500/5' 
            : 'border-white/10 bg-surface'
        }`}>
          <View className="flex-row items-center justify-center">
            {loading && <ActivityIndicator size="small" color={Brand.primary} className="mr-2" />}
            <Text className={`text-center text-pos-xl tracking-[10px] ${
              isPinLocked 
                ? 'text-red-400' 
                : error 
                ? 'text-yellow-400' 
                : 'text-pos-text-strong'
            }`}>
              {maskedPin || '------'}
            </Text>
          </View>
        </View>

        {/* Error Message */}
        {error && (
          <Text className={`mt-3 text-center text-pos-sm font-semibold ${
            isPinLocked ? 'text-red-400' : 'text-yellow-400'
          }`}>
            {error}
          </Text>
        )}

        {/* PIN Keypad */}
        <View className="mt-5 flex-row flex-wrap justify-between">
          {keys.map((key) => {
            const isAction = key === 'C' || key === '⌫';
            const isDisabled = loading || (isPinLocked && key !== 'C');

            return (
              <Pressable
                key={key}
                className={`mb-3 h-16 w-[31%] items-center justify-center rounded-lg border ${
                  isDisabled
                    ? 'border-white/5 bg-surface/30'
                    : isAction
                    ? 'border-white/10 bg-surface active:bg-surface-soft'
                    : 'border-brand/30 bg-brand/20 active:bg-brand/30'
                }`}
                disabled={isDisabled}
                onPress={() => {
                  if (key === 'C') {
                    onClear();
                  } else if (key === '⌫') {
                    onBackspace();
                  } else {
                    onDigitPress(key);
                  }
                }}>
                <Text className={`text-pos-xl font-semibold ${
                  isDisabled
                    ? 'text-pos-muted/30'
                    : isAction
                    ? 'text-pos-muted'
                    : 'text-brand'
                }`}>
                  {key}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Sign Out Button */}
        <Pressable
          className="mt-4 rounded-lg border border-white/10 bg-surface p-3 active:bg-surface-soft"
          onPress={onSignOut}
          disabled={loading}>
          <Text className="text-center text-pos-sm text-pos-muted">
            Sign out and use different account
          </Text>
        </Pressable>

        {/* Security Info */}
        <Text className="mt-3 text-center text-pos-xs text-pos-muted/70">
          🔒 PIN is validated securely without sending over network
        </Text>
      </View>
    </View>
  );
}
