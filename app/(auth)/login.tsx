import Auth from '@/components/Auth';
import { supabase } from '@/lib/supabase';
import { JwtPayload } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import 'react-native-url-polyfill/auto';

/**
 * Login screen - email/password authentication.
 * To be fully implemented in Step 3.
 */
export default function LoginScreen() {
  const [claims, setClaims] = useState<JwtPayload | null>(null);

  useEffect(() => {
    supabase.auth.getClaims().then(({ data }) => {
      setClaims(data?.claims ?? null);
    });

    supabase.auth.onAuthStateChange(() => {
      supabase.auth.getClaims().then(({ data }) => {
        setClaims(data?.claims ?? null);
      });
    });
  }, []);

  return (
    <View className="flex-1 bg-surface">
      <View className="flex-1 items-center justify-center p-8">
        <View className="w-full max-w-md rounded-2xl border border-white/10 bg-surface-soft p-6">
          <Text className="mb-6 text-center text-pos-2xl font-bold text-pos-text-strong">
            POS Tempest Login
          </Text>
          <Auth />
          {claims && (
            <View className="mt-4">
              <Text className="text-pos-sm text-pos-muted">User ID: {claims.sub}</Text>
              <Pressable
                className="mt-4 rounded-lg bg-brand p-3"
                onPress={() => router.replace('/floor')}>
                <Text className="text-center text-pos-base font-semibold text-white">
                  Go to Floor Plan
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
