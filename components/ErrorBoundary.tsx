import * as Sentry from '@sentry/react-native';
import { PropsWithChildren } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ThemeColors } from '@/constants/theme';

function ErrorFallback({
  error,
  resetError,
}: {
  error: Error;
  resetError: () => void;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>{error.message}</Text>
      <TouchableOpacity style={styles.button} onPress={resetError}>
        <Text style={styles.buttonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

export function AppErrorBoundary({ children }: PropsWithChildren) {
  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <ErrorFallback error={error as Error} resetError={resetError} />
      )}
      beforeCapture={(scope) => {
        scope.setTag('boundary', 'app');
      }}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: ThemeColors.surfaces.base,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: ThemeColors.text.primary,
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    color: ThemeColors.text.muted,
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    backgroundColor: ThemeColors.info.DEFAULT,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: ThemeColors.text.strong,
    fontSize: 15,
    fontWeight: '600',
  },
});
