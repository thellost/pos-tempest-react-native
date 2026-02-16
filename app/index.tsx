import { Redirect } from 'expo-router';

/**
 * Root index - initial route handler.
 * Currently redirects to auth/login since auth isn't fully implemented.
 * Will be updated in Step 3 to check auth state properly.
 */
export default function Index() {
  // TODO Step 3: Check if user is authenticated
  // const { isAuthenticated } = useAuth();
  // if (isAuthenticated) return <Redirect href="/(app)/floor" />;
  
  // For now, show login screen
  return <Redirect href="/(auth)/login" />;
}
