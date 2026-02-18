import { useAuth } from '@/hooks/use-auth';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import 'react-native-url-polyfill/auto';

/**
 * Secure login screen with email/password authentication.
 * Features:
 * - Input validation and sanitization
 * - Rate limiting with visual feedback
 * - Secure error messages
 * - Automatic redirect on successful authentication
 */
export default function LoginScreen() {
  const { 
    isAuthenticated, 
    isLocked, 
    signIn, 
    loginAttempts,
    isLoginLocked,
    loginResetInMs,
  } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [lockTimeRemaining, setLockTimeRemaining] = useState(0);

  // Update lock timer
  useEffect(() => {
    if (isLoginLocked && loginResetInMs > 0) {
      setLockTimeRemaining(Math.ceil(loginResetInMs / 1000));
      
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
  }, [isLoginLocked, loginResetInMs]);

  useEffect(() => {
    if (isAuthenticated && !isLocked) {
      router.replace('/(app)/floor');
    }
  }, [isAuthenticated, isLocked]);

  async function handleSignIn() {
    // Client-side validation
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      Alert.alert('Missing Information', 'Please enter both email and password.');
      return;
    }

    if (trimmedPassword.length < 6) {
      Alert.alert('Invalid Password', 'Password must be at least 6 characters.');
      return;
    }

    if (isLoginLocked) {
      const minutes = Math.ceil(lockTimeRemaining / 60);
      Alert.alert(
        'Account Temporarily Locked',
        `Too many failed attempts. Please try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`,
      );
      return;
    }

    try {
      setLoading(true);
      await signIn(trimmedEmail, trimmedPassword);
      // Navigation handled by useEffect
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      
      // Show remaining attempts if rate-limited
      if (loginAttempts > 0 && !isLoginLocked) {
        Alert.alert(
          'Login Failed',
          `${message}\n\nRemaining attempts: ${loginAttempts}`,
        );
      } else if (isLoginLocked) {
        Alert.alert(
          'Account Locked',
          message,
        );
      } else {
        Alert.alert('Login Failed', message);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleKeyPress() {
    if (email.trim() && password.trim() && !loading && !isLoginLocked) {
      handleSignIn();
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

  return (
    <View className="flex-1 bg-surface">
      <View className="flex-1 items-center justify-center p-8">
        <View className="w-full max-w-md rounded-2xl border border-white/10 bg-surface-soft p-6">
          {/* Header */}
          <Text className="mb-2 text-center text-pos-2xl font-bold text-pos-text-strong">
            POS Tempest
          </Text>
          <Text className="mb-6 text-center text-pos-sm text-pos-muted">
            Sign in to continue
          </Text>

          {/* Rate Limit Warning */}
          {isLoginLocked && lockTimeRemaining > 0 && (
            <View className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              <Text className="text-center text-pos-sm font-semibold text-red-400">
                Account temporarily locked
              </Text>
              <Text className="mt-1 text-center text-pos-xs text-red-300">
                Try again in {formatLockTime(lockTimeRemaining)}
              </Text>
            </View>
          )}

          {/* Remaining Attempts Warning */}
          {!isLoginLocked && loginAttempts > 0 && loginAttempts <= 2 && (
            <View className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
              <Text className="text-center text-pos-sm text-yellow-400">
                {loginAttempts} {loginAttempts === 1 ? 'attempt' : 'attempts'} remaining
              </Text>
            </View>
          )}

          {/* Email Input */}
          <Text className="mb-2 text-pos-sm font-semibold text-pos-muted">Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="your@email.com"
            placeholderTextColor="#94a3b8"
            editable={!loading && !isLoginLocked}
            returnKeyType="next"
            className={`mb-4 rounded-lg border px-4 py-3 text-pos-base ${
              isLoginLocked
                ? 'border-white/5 bg-surface/50 text-pos-muted'
                : 'border-white/10 bg-surface text-pos-text-strong'
            }`}
          />

          {/* Password Input */}
          <Text className="mb-2 text-pos-sm font-semibold text-pos-muted">Password</Text>
          <View className="relative mb-6">
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="password"
              autoCorrect={false}
              placeholder="••••••••"
              placeholderTextColor="#94a3b8"
              editable={!loading && !isLoginLocked}
              returnKeyType="go"
              onSubmitEditing={handleKeyPress}
              className={`rounded-lg border px-4 py-3 pr-12 text-pos-base ${
                isLoginLocked
                  ? 'border-white/5 bg-surface/50 text-pos-muted'
                  : 'border-white/10 bg-surface text-pos-text-strong'
              }`}
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              disabled={loading || isLoginLocked}
              className="absolute right-3 top-3">
              <Text className="text-pos-sm text-pos-muted">
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </Text>
            </Pressable>
          </View>

          {/* Sign In Button */}
          <Pressable
            className={`rounded-lg p-3 ${
              loading || isLoginLocked || !email.trim() || !password.trim()
                ? 'bg-brand/30'
                : 'bg-brand active:bg-brand-dark'
            }`}
            onPress={handleSignIn}
            disabled={loading || isLoginLocked || !email.trim() || !password.trim()}>
            <View className="flex-row items-center justify-center">
              {loading && <ActivityIndicator size="small" color="#ffffff" className="mr-2" />}
              <Text className="text-center text-pos-base font-semibold text-white">
                {loading ? 'Signing in...' : isLoginLocked ? 'Locked' : 'Sign in'}
              </Text>
            </View>
          </Pressable>

          {/* Security Notice */}
          <Text className="mt-4 text-center text-pos-xs text-pos-muted/70">
            🔒 Your credentials are encrypted and secure
          </Text>
        </View>
      </View>
    </View>
  );
}
