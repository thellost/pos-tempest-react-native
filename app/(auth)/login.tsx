import { Colors, ThemeColors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { Eye, EyeOff, Zap } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { Button, IconButton } from '@/components/ui';
import 'react-native-url-polyfill/auto';

export default function LoginScreen() {
  const {
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
    <KeyboardAvoidingView
      className="flex-1 bg-surface"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 16 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="w-full max-w-md self-center rounded-2xl border border-border bg-surface-card p-5">
          <View className="mb-2 h-10 w-10 items-center justify-center self-center rounded-xl bg-accent-muted">
            <Zap size={22} color={ThemeColors.accent.primary} />
          </View>
          <Text className="mb-1 text-center text-pos-xl font-bold text-pos-text">
            POS Tempest
          </Text>
          <Text className="mb-4 text-center text-pos-sm text-pos-text-muted">
            Sign in to continue
          </Text>

          {isLoginLocked && lockTimeRemaining > 0 && (
            <View className="mb-4 rounded-xl border border-pos-danger/30 bg-pos-danger-muted p-3">
              <Text className="text-center text-pos-sm font-semibold text-pos-danger">
                Account temporarily locked
              </Text>
              <Text className="mt-1 text-center text-pos-xs text-pos-danger">
                Try again in {formatLockTime(lockTimeRemaining)}
              </Text>
            </View>
          )}

          {!isLoginLocked && loginAttempts > 0 && loginAttempts <= 2 && (
            <View className="mb-4 rounded-xl border border-pos-warning/30 bg-pos-warning-muted p-3">
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
            className="mb-4 rounded-xl border border-border bg-surface px-4 py-3 text-pos-base text-pos-text"
          />

          <Text className="mb-2 text-pos-sm font-semibold text-pos-text-muted">Password</Text>
          <View className="relative mb-5">
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
              className="rounded-xl border border-border bg-surface px-4 py-3 pr-12 text-pos-base text-pos-text"
            />
            <IconButton
              onPress={() => setShowPassword(!showPassword)}
              disabled={loading || isLoginLocked}
              size="sm"
              className="absolute right-3 top-2.5 bg-transparent"
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword
                ? <Eye size={18} color={ThemeColors.text.muted} />
                : <EyeOff size={18} color={ThemeColors.text.muted} />}
            </IconButton>
          </View>

          <Button
            className="items-center justify-center rounded-xl bg-accent p-3.5"
            onPress={handleSignIn}
            disabled={loading || isLoginLocked || !email.trim() || !password.trim()}>
            <View className="flex-row items-center justify-center">
              {loading && <ActivityIndicator size="small" color={Colors.light.white} className="mr-2" />}
              <Text className="text-center text-pos-base font-semibold text-white">
                {loading ? 'Signing in...' : isLoginLocked ? 'Locked' : 'Sign in'}
              </Text>
            </View>
          </Button>

          <Text className="mt-4 text-center text-pos-xs text-pos-text-faint">
            Your credentials are encrypted and secure
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
