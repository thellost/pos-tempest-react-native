import { ThemeColors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { Button, IconButton, ShakeField } from '@/components/ui';
import type { ShakeFieldRef } from '@/components/ui';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain || local.length <= 2) return email;
  return `${local.slice(0, 2)}***@${domain}`;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);

  // Step 1
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const emailRef = useRef<ShakeFieldRef>(null);

  // Step 2
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [resendConfirm, setResendConfirm] = useState(false);
  const otpRef = useRef<ShakeFieldRef>(null);

  // Step 3
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const newPasswordRef = useRef<ShakeFieldRef>(null);
  const confirmPasswordRef = useRef<ShakeFieldRef>(null);

  async function sendOtp(targetEmail: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email: targetEmail,
      options: { shouldCreateUser: false },
    });
    if (error) throw error;
  }

  async function handleSendCode() {
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError('Email is required.');
      emailRef.current?.shake();
      return;
    }
    if (!isValidEmail(trimmed)) {
      setEmailError('Please enter a valid email address.');
      emailRef.current?.shake();
      return;
    }
    setEmailError('');
    try {
      setLoading(true);
      await sendOtp(trimmed);
      setStep(2);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send code.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    const trimmed = otp.trim();
    if (trimmed.length !== 6 || !/^\d{6}$/.test(trimmed)) {
      setOtpError('Please enter the 6-digit code.');
      otpRef.current?.shake();
      return;
    }
    setOtpError('');
    try {
      setLoading(true);
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: trimmed,
        type: 'email',
      });
      if (error) {
        const lower = error.message.toLowerCase();
        if (lower.includes('invalid') || lower.includes('expired')) {
          otpRef.current?.shake();
        }
        Alert.alert('Error', error.message);
        return;
      }
      setStep(3);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    try {
      setLoading(true);
      await sendOtp(email.trim());
      setResendConfirm(true);
      setTimeout(() => setResendConfirm(false), 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to resend code.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdatePassword() {
    let hasError = false;

    if (newPassword.length < 8) {
      setNewPasswordError('Password must be at least 8 characters.');
      newPasswordRef.current?.shake();
      hasError = true;
    } else {
      setNewPasswordError('');
    }

    if (confirmPassword !== newPassword) {
      setConfirmPasswordError('Passwords do not match.');
      confirmPasswordRef.current?.shake();
      hasError = true;
    } else {
      setConfirmPasswordError('');
    }

    if (hasError) return;

    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }
      Alert.alert('Success', 'Your password has been updated. Please sign in.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update password.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }

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
        {/* Back button */}
        <Pressable
          onPress={() => router.back()}
          className="mb-4 flex-row items-center self-start"
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={18} color={ThemeColors.text.muted} />
          <Text className="ml-1 text-pos-sm text-pos-text-muted">Back</Text>
        </Pressable>

        <View className="w-full max-w-md self-center rounded-2xl border border-border bg-surface-card p-5">
          {/* ── Step 1: Request OTP ── */}
          {step === 1 && (
            <>
              <Text className="mb-1 text-center text-pos-xl font-bold text-pos-text">
                Forgot Password
              </Text>
              <Text className="mb-5 text-center text-pos-sm text-pos-text-muted">
                Enter your account email and we&apos;ll send you a verification code.
              </Text>

              <Text className="mb-2 text-pos-sm font-semibold text-pos-text-muted">Email</Text>
              <ShakeField ref={emailRef} className="mb-5">
                <TextInput
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    if (emailError) setEmailError('');
                  }}
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="your@email.com"
                  placeholderTextColor={ThemeColors.text.faint}
                  editable={!loading}
                  returnKeyType="done"
                  onSubmitEditing={handleSendCode}
                  className="rounded-xl border border-border bg-surface px-4 py-3 text-pos-base text-pos-text"
                />
                {emailError ? (
                  <Text className="mt-1 text-pos-xs text-pos-danger">{emailError}</Text>
                ) : null}
              </ShakeField>

              <Button
                className="items-center justify-center rounded-xl bg-accent p-3.5"
                onPress={handleSendCode}
                disabled={loading || !email.trim()}
              >
                <View className="flex-row items-center justify-center">
                  {loading && (
                    <ActivityIndicator size="small" color="#fff" className="mr-2" />
                  )}
                  <Text className="text-center text-pos-base font-semibold text-white">
                    {loading ? 'Sending...' : 'Send Code'}
                  </Text>
                </View>
              </Button>

              <Pressable
                onPress={() => router.back()}
                className="mt-4 items-center"
                accessibilityRole="link"
              >
                <Text className="text-pos-sm text-brand">Back to sign in</Text>
              </Pressable>
            </>
          )}

          {/* ── Step 2: Verify OTP ── */}
          {step === 2 && (
            <>
              <Text className="mb-1 text-center text-pos-xl font-bold text-pos-text">
                Enter Verification Code
              </Text>
              <Text className="mb-4 text-center text-pos-sm text-pos-text-muted">
                We sent a 6-digit code to {maskEmail(email.trim())}
              </Text>

              {/* Website guide callout */}
              <View className="mb-5 rounded-xl border border-brand/30 bg-brand/10 px-4 py-3">
                <Text className="mb-1 text-pos-xs font-semibold text-brand">
                  💡 Want to change your password?
                </Text>
                <Text className="text-pos-xs leading-5 text-pos-text-muted">
                  After verifying your code, visit our website to update your password:
                </Text>
                <Pressable
                  onPress={() => Linking.openURL('https://tempest.zidan.id')}
                  accessibilityRole="link"
                >
                  <Text className="mt-1 text-pos-xs font-semibold text-brand underline">
                    tempest.zidan.id
                  </Text>
                </Pressable>
              </View>

              <Text className="mb-2 text-pos-sm font-semibold text-pos-text-muted">
                Verification Code
              </Text>
              <ShakeField ref={otpRef} className="mb-5">
                <TextInput
                  value={otp}
                  onChangeText={(v) => {
                    setOtp(v);
                    if (otpError) setOtpError('');
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="000000"
                  placeholderTextColor={ThemeColors.text.faint}
                  editable={!loading}
                  returnKeyType="done"
                  onSubmitEditing={handleVerifyOtp}
                  className="rounded-xl border border-border bg-surface px-4 py-3 text-center text-pos-base tracking-widest text-pos-text"
                />
                {otpError ? (
                  <Text className="mt-1 text-pos-xs text-pos-danger">{otpError}</Text>
                ) : null}
              </ShakeField>

              {resendConfirm && (
                <Text className="mb-3 text-center text-pos-xs text-pos-success">
                  Code resent successfully.
                </Text>
              )}

              <Button
                className="items-center justify-center rounded-xl bg-accent p-3.5"
                onPress={handleVerifyOtp}
                disabled={loading || otp.trim().length !== 6}
              >
                <View className="flex-row items-center justify-center">
                  {loading && (
                    <ActivityIndicator size="small" color="#fff" className="mr-2" />
                  )}
                  <Text className="text-center text-pos-base font-semibold text-white">
                    {loading ? 'Verifying...' : 'Verify Code'}
                  </Text>
                </View>
              </Button>

              <Pressable
                onPress={handleResendCode}
                disabled={loading}
                className="mt-3 items-center"
                accessibilityRole="button"
              >
                <Text className="text-pos-sm text-brand">Resend code</Text>
              </Pressable>

              <Pressable
                onPress={() => setStep(1)}
                className="mt-3 items-center"
                accessibilityRole="button"
              >
                <Text className="text-pos-sm text-pos-text-muted">Back</Text>
              </Pressable>
            </>
          )}

          {/* ── Step 3: Set New Password ── */}
          {step === 3 && (
            <>
              <Text className="mb-1 text-center text-pos-xl font-bold text-pos-text">
                Set New Password
              </Text>
              <Text className="mb-5 text-center text-pos-sm text-pos-text-muted">
                Choose a strong password of at least 8 characters.
              </Text>

              <Text className="mb-2 text-pos-sm font-semibold text-pos-text-muted">
                New Password
              </Text>
              <ShakeField ref={newPasswordRef} className="relative mb-4">
                <TextInput
                  value={newPassword}
                  onChangeText={(v) => {
                    setNewPassword(v);
                    if (newPasswordError) setNewPasswordError('');
                  }}
                  secureTextEntry={!showNew}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="••••••••"
                  placeholderTextColor={ThemeColors.text.faint}
                  editable={!loading}
                  returnKeyType="next"
                  className="rounded-xl border border-border bg-surface px-4 py-3 pr-12 text-pos-base text-pos-text"
                />
                <IconButton
                  onPress={() => setShowNew(!showNew)}
                  disabled={loading}
                  size="sm"
                  className="absolute right-3 top-2.5 bg-transparent"
                  accessibilityRole="button"
                  accessibilityLabel={showNew ? 'Hide password' : 'Show password'}
                >
                  {showNew
                    ? <Eye size={18} color={ThemeColors.text.muted} />
                    : <EyeOff size={18} color={ThemeColors.text.muted} />}
                </IconButton>
                {newPasswordError ? (
                  <Text className="mt-1 text-pos-xs text-pos-danger">{newPasswordError}</Text>
                ) : null}
              </ShakeField>

              <Text className="mb-2 text-pos-sm font-semibold text-pos-text-muted">
                Confirm Password
              </Text>
              <ShakeField ref={confirmPasswordRef} className="relative mb-5">
                <TextInput
                  value={confirmPassword}
                  onChangeText={(v) => {
                    setConfirmPassword(v);
                    if (confirmPasswordError) setConfirmPasswordError('');
                  }}
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="••••••••"
                  placeholderTextColor={ThemeColors.text.faint}
                  editable={!loading}
                  returnKeyType="done"
                  onSubmitEditing={handleUpdatePassword}
                  className="rounded-xl border border-border bg-surface px-4 py-3 pr-12 text-pos-base text-pos-text"
                />
                <IconButton
                  onPress={() => setShowConfirm(!showConfirm)}
                  disabled={loading}
                  size="sm"
                  className="absolute right-3 top-2.5 bg-transparent"
                  accessibilityRole="button"
                  accessibilityLabel={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm
                    ? <Eye size={18} color={ThemeColors.text.muted} />
                    : <EyeOff size={18} color={ThemeColors.text.muted} />}
                </IconButton>
                {confirmPasswordError ? (
                  <Text className="mt-1 text-pos-xs text-pos-danger">{confirmPasswordError}</Text>
                ) : null}
              </ShakeField>

              <Button
                className="items-center justify-center rounded-xl bg-accent p-3.5"
                onPress={handleUpdatePassword}
                disabled={loading || !newPassword || !confirmPassword}
              >
                <View className="flex-row items-center justify-center">
                  {loading && (
                    <ActivityIndicator size="small" color="#fff" className="mr-2" />
                  )}
                  <Text className="text-center text-pos-base font-semibold text-white">
                    {loading ? 'Updating...' : 'Update Password'}
                  </Text>
                </View>
              </Button>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
