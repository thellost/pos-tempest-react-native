import { Brand, ThemeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { Redirect, router } from 'expo-router';
import { Delete, Lock } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from '@/components/ui';

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
        if (result.remainingAttempts === -1) {
          // Sentinel: PowerSync is re-syncing after a long idle — local DB temporarily empty.
          // Don't count this as a failed attempt.
          setError('Data is syncing. Please wait a moment and try again.');
          setPin('');
          return;
        }
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

    setError(null);
    const nextPin = `${pin}${digit}`;
    setPin(nextPin);

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
    } catch {
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
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 16 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View className="w-full max-w-md self-center rounded-2xl border border-border bg-surface-card p-5">
        <View className="mb-2 h-10 w-10 items-center justify-center self-center rounded-xl bg-accent-muted">
          <Lock size={22} color={ThemeColors.accent.primary} />
        </View>
        <Text className="text-center text-pos-xl font-bold text-pos-text">
          Enter PIN
        </Text>
        <Text className="mt-1 text-center text-pos-sm text-pos-text-muted">
          {authUser?.email ?? 'Locked session'}
        </Text>

        {isPinLocked && lockTimeRemaining > 0 && (
          <View className="mt-3 rounded-xl border border-pos-danger/30 bg-pos-danger-muted p-3">
            <Text className="text-center text-pos-sm font-semibold text-pos-danger">
              Too many failed attempts
            </Text>
            <Text className="mt-1 text-center text-pos-base font-bold text-pos-danger">
              Locked for {formatLockTime(lockTimeRemaining)}
            </Text>
          </View>
        )}

        {!isPinLocked && pinAttempts > 0 && pinAttempts <= 2 && (
          <View className="mt-3 rounded-xl border border-pos-warning/30 bg-pos-warning-muted p-3">
            <Text className="text-center text-pos-sm text-pos-warning">
              {pinAttempts} {pinAttempts === 1 ? 'attempt' : 'attempts'} remaining
            </Text>
          </View>
        )}

        <View className={`mt-4 rounded-xl border px-4 py-3 ${
          isPinLocked
            ? 'border-pos-danger/30 bg-pos-danger-muted'
            : error
            ? 'border-pos-warning/30 bg-pos-warning-muted'
            : 'border-border bg-surface'
        }`}>
          <View className="flex-row items-center justify-center">
            {loading && <ActivityIndicator size="small" color={Brand.primary} className="mr-2" />}
            <Text className={`text-center text-pos-xl tracking-[12px] ${
              isPinLocked
                ? 'text-pos-danger'
                : error
                ? 'text-pos-warning'
                : 'text-pos-text'
            }`}>
              {maskedPin || '------'}
            </Text>
          </View>
        </View>

        {error && (
          <Text className={`mt-2 text-center text-pos-sm font-semibold ${
            isPinLocked ? 'text-pos-danger' : 'text-pos-warning'
          }`}>
            {error}
          </Text>
        )}

        <View className="mt-4 flex-row flex-wrap justify-between">
          {keys.map((key) => {
            const isAction = key === 'C' || key === '⌫';
            const isDisabled = loading || (isPinLocked && key !== 'C');

            return (
              <Pressable
                key={key}
                className={`mb-2 h-12 w-[31%] items-center justify-center rounded-xl border ${
                  isDisabled
                    ? 'border-border bg-surface-card/50'
                    : isAction
                    ? 'border-border bg-surface-card'
                    : 'border-accent/30 bg-accent-muted'
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
                {key === '⌫' ? (
                  <Delete size={20} color={isDisabled ? ThemeColors.text.faint : ThemeColors.text.muted} />
                ) : (
                  <Text className={`text-pos-lg font-semibold ${
                    isDisabled
                      ? 'text-pos-text-faint/50'
                      : isAction
                      ? 'text-pos-text-muted'
                      : 'text-accent'
                  }`}>
                    {key}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>

        <Button
          className="mt-3 items-center justify-center rounded-xl border border-border bg-surface-card p-3"
          onPress={onSignOut}
          disabled={loading}>
          <Text className="text-center text-pos-sm text-pos-text-muted">
            Sign out and use different account
          </Text>
        </Button>

        <Text className="mt-3 text-center text-pos-xs text-pos-text-faint">
          PIN is validated securely without sending over network
        </Text>
      </View>
    </ScrollView>
  );
}
