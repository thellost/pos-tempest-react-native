import { useAuth } from '@/hooks/use-auth';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import 'react-native-url-polyfill/auto';

/**
 * Login screen - email/password authentication.
 * To be fully implemented in Step 3.
 */
export default function LoginScreen() {
  const { isAuthenticated, isLocked, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !isLocked) {
      router.replace('/(app)/floor');
    }
  }, [isAuthenticated, isLocked]);

  async function handleSignIn() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing info', 'Please enter both email and password.');
      return;
    }

    try {
      setLoading(true);
      await signIn(email.trim(), password);
      router.replace('/(app)/floor');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      Alert.alert('Sign in failed', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-surface">
      <View className="flex-1 items-center justify-center p-8">
        <View className="w-full max-w-md rounded-2xl border border-white/10 bg-surface-soft p-6">
          <Text className="mb-6 text-center text-pos-2xl font-bold text-pos-text-strong">
            POS Tempest Login
          </Text>

          <Text className="mb-2 text-pos-sm font-semibold text-pos-muted">Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="email@address.com"
            placeholderTextColor="#94a3b8"
            className="mb-4 rounded-lg border border-white/10 bg-surface px-4 py-3 text-pos-base text-pos-text-strong"
          />

          <Text className="mb-2 text-pos-sm font-semibold text-pos-muted">Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder="Password"
            placeholderTextColor="#94a3b8"
            className="mb-6 rounded-lg border border-white/10 bg-surface px-4 py-3 text-pos-base text-pos-text-strong"
          />

          <Pressable
            className={`rounded-lg p-3 ${loading ? 'bg-brand/50' : 'bg-brand'}`}
            onPress={handleSignIn}
            disabled={loading}>
            <Text className="text-center text-pos-base font-semibold text-white">
              {loading ? 'Signing in...' : 'Sign in'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
