import { useAuth } from '@/hooks/use-auth';
import { Redirect, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

/**
 * PIN unlock screen - quick authentication.
 * To be implemented in Step 3.
 */
export default function PinScreen() {
  const { authUser, isAuthenticated, unlockWithPin, signOut } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const maskedPin = useMemo(() => '•'.repeat(pin.length), [pin]);

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  async function submitPin(candidate: string) {
    if (candidate.length !== 6 || loading) {
      return;
    }

    try {
      setLoading(true);
      const ok = await unlockWithPin(candidate);

      if (!ok) {
        setError('Wrong PIN, try again.');
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
    if (loading || pin.length >= 6) {
      return;
    }

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

    setPin(pin.slice(0, -1));
  }

  async function onSignOut() {
    await signOut();
    router.replace('/(auth)/login');
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

  return (
    <View className="flex-1 items-center justify-center bg-surface px-6">
      <View className="w-full max-w-md rounded-2xl border border-white/10 bg-surface-soft p-6">
        <Text className="text-center text-pos-2xl font-bold text-pos-text-strong">Unlock POS</Text>
        <Text className="mt-2 text-center text-pos-sm text-pos-muted">
          {authUser?.email ?? 'Active session'}
        </Text>

        <View className="mt-6 rounded-lg border border-white/10 bg-surface px-4 py-3">
          <Text className="text-center text-pos-xl tracking-[10px] text-pos-text-strong">
            {maskedPin || '------'}
          </Text>
        </View>

        {error ? <Text className="mt-3 text-center text-pos-sm text-red-400">{error}</Text> : null}

        <View className="mt-5 flex-row flex-wrap justify-between">
          {keys.map((key) => {
            const isAction = key === 'C' || key === '⌫';

            return (
              <Pressable
                key={key}
                className={`mb-3 h-16 w-[31%] items-center justify-center rounded-lg border border-white/10 ${
                  isAction ? 'bg-surface' : 'bg-brand/20'
                }`}
                onPress={() => {
                  if (key === 'C') {
                    setPin('');
                    setError(null);
                    return;
                  }

                  if (key === '⌫') {
                    onBackspace();
                    return;
                  }

                  onDigitPress(key);
                }}>
                <Text className="text-pos-lg font-semibold text-pos-text-strong">{key}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable className="mt-2 rounded-lg border border-white/10 bg-surface p-3" onPress={onSignOut}>
          <Text className="text-center text-pos-base font-semibold text-pos-text-strong">Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}
