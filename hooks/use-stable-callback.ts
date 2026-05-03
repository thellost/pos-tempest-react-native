import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Returns a stable function identity that always calls the latest callback.
 * Useful for memoized children that should not re-render only because a parent
 * callback closed over new state.
 */
export function useStableCallback<TCallback extends (...args: never[]) => unknown>(
  callback: TCallback
): TCallback {
  const callbackRef = useRef(callback);

  useLayoutEffect(() => {
    callbackRef.current = callback;
  });

  return useCallback(((...args: Parameters<TCallback>): ReturnType<TCallback> => {
    return callbackRef.current(...args) as ReturnType<TCallback>;
  }) as TCallback, []);
}
