import { Colors, ThemeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { router } from 'expo-router';
import { Eye, EyeOff, Zap } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import 'react-native-url-polyfill/auto';

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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      
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

  function onSubmitEditing() {
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
        <View className="w-full max-w-md rounded-2xl border border-border bg-surface-card p-8">
          <View className="mb-2 h-14 w-14 items-center justify-center self-center rounded-2xl bg-accent-muted">
            <Zap size={28} color={ThemeColors.accent.primary} />
          </View>
          <Text className="mb-2 text-center text-pos-2xl font-bold text-pos-text">
            POS Tempest
          </Text>
          <Text className="mb-8 text-center text-pos-sm text-pos-text-muted">
            Sign in to continue
          </Text>

          {isLoginLocked && lockTimeRemaining > 0 && (
            <View className="mb-5 rounded-xl border border-pos-danger/30 bg-pos-danger-muted p-4">
              <Text className="text-center text-pos-sm font-semibold text-pos-danger">
                Account temporarily locked
              </Text>
              <Text className="mt-1 text-center text-pos-xs text-pos-danger">
                Try again in {formatLockTime(lockTimeRemaining)}
              </Text>
            </View>
          )}

          {!isLoginLocked && loginAttempts > 0 && loginAttempts <= 2 && (
            <View className="mb-5 rounded-xl border border-pos-warning/30 bg-pos-warning-muted p-4">
              <Text className="text-center text-pos-sm text-pos-warning">
                {loginAttempts} {loginAttempts === 1 ? 'attempt' : 'attempts'} remaining
              </Text>
            </View>
          )}

          <Text className="mb-2 text-pos-sm font-semibold text-pos-text-muted">Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="your@email.com"
            placeholderTextColor="#64748B"
            editable={!loading && !isLoginLocked}
            returnKeyType="next"
            className="mb-5 rounded-xl border border-border bg-surface px-4 py-3.5 text-pos-base text-pos-text"
          />

          <Text className="mb-2 text-pos-sm font-semibold text-pos-text-muted">Password</Text>
          <View className="relative mb-8">
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="password"
              autoCorrect={false}
              placeholder="••••••••"
              placeholderTextColor="#64748B"
              editable={!loading && !isLoginLocked}
              returnKeyType="go"
              onSubmitEditing={onSubmitEditing}
              className="rounded-xl border border-border bg-surface px-4 py-3.5 pr-12 text-pos-base text-pos-text"
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              disabled={loading || isLoginLocked}
              className="absolute right-3 top-3"
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword
                ? <Eye size={18} color={ThemeColors.text.muted} />
                : <EyeOff size={18} color={ThemeColors.text.muted} />}
            </Pressable>
          </View>

          <Pressable
            className={`rounded-xl p-4 ${
              loading || isLoginLocked || !email.trim() || !password.trim()
                ? 'bg-accent/30'
                : 'bg-accent'
            }`}
            onPress={handleSignIn}
            disabled={loading || isLoginLocked || !email.trim() || !password.trim()}>
            <View className="flex-row items-center justify-center">
              {loading && <ActivityIndicator size="small" color={Colors.light.white} className="mr-2" />}
              <Text className="text-center text-pos-base font-semibold text-white">
                {loading ? 'Signing in...' : isLoginLocked ? 'Locked' : 'Sign in'}
              </Text>
            </View>
          </Pressable>

          <Text className="mt-5 text-center text-pos-xs text-pos-text-faint">
            Your credentials are encrypted and secure
          </Text>
        </View>
      </View>
    </View>
  );
}
