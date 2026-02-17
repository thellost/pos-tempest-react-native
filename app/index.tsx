import { useAuth } from '@/hooks/use-auth';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

/**
 * Root index - initial route handler.
 * Currently redirects to auth/login since auth isn't fully implemented.
 * Will be updated in Step 3 to check auth state properly.
 */
export default function Index() {
  const { loading, isAuthenticated, isLocked } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (isLocked) {
    return <Redirect href="/(auth)/pin" />;
  }

  return <Redirect href="/(app)/floor" />;
}
