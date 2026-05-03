import {
    Children,
    Fragment,
    Profiler,
    createElement,
    useLayoutEffect,
    useRef,
    type ProfilerOnRenderCallback,
    type ReactNode,
} from 'react';

const TAG = '[⏱ perf]';
const ENABLE_RENDER_PROFILER = process.env.EXPO_PUBLIC_ENABLE_RENDER_PROFILER === 'true';

export function isRenderProfilerEnabled(): boolean {
  return __DEV__ && ENABLE_RENDER_PROFILER;
}

/**
 * High-resolution timestamp in milliseconds.
 * Uses performance.now() when available, falls back to Date.now().
 */
export function nowMs(): number {
  if (
    typeof globalThis.performance !== 'undefined' &&
    typeof globalThis.performance.now === 'function'
  ) {
    return globalThis.performance.now();
  }
  return Date.now();
}

/**
 * Logs a perf measurement to the console (dev only).
 * @param label - What was measured
 * @param ms - Duration in milliseconds
 * @param meta - Optional extra data to log
 */
export function logPerf(
  label: string,
  ms: number,
  meta?: Record<string, unknown>
): void {
  if (!__DEV__) return;

  const rounded = Math.round(ms * 100) / 100; // 2 decimal places
  const icon = rounded > 100 ? '🔴' : rounded > 30 ? '🟡' : '🟢';

  if (meta) {
    console.log(`${TAG} ${icon} ${label}: ${rounded}ms`, meta);
  } else {
    console.log(`${TAG} ${icon} ${label}: ${rounded}ms`);
  }
}

/**
 * Hook that measures how long a component render takes.
 * Logs on every render (mount + updates).
 *
 * Usage:
 *   useRenderTimer('OrderPanel');
 */
export function useRenderTimer(componentName: string): void {
  const renderStart = useRef(nowMs());

  // Capture start time BEFORE effects run (during render phase)
  renderStart.current = nowMs();

  useLayoutEffect(() => {
    if (!isRenderProfilerEnabled()) return;

    const elapsed = nowMs() - renderStart.current;
    logPerf(`render:${componentName}`, elapsed);
  });
}

/**
 * Hook that measures how long the initial mount render takes.
 * Only logs once on mount, not on re-renders.
 *
 * Usage:
 *   useMountTimer('OrderScreen');
 */
export function useMountTimer(componentName: string): void {
  const mountStart = useRef(nowMs());

  useLayoutEffect(() => {
    logPerf(`mount:${componentName}`, nowMs() - mountStart.current);
  }, [componentName]);
}

/**
 * Wraps an async function and logs how long it takes.
 * Returns the result of the function.
 *
 * Usage:
 *   const data = await timedAsync('loadOrder', () => getOrderWithItems(id));
 */
export async function timedAsync<T>(
  label: string,
  fn: () => Promise<T>,
  meta?: Record<string, unknown>
): Promise<T> {
  if (!__DEV__) return fn();

  const start = nowMs();
  try {
    const result = await fn();
    logPerf(label, nowMs() - start, meta);
    return result;
  } catch (error) {
    logPerf(`${label} (FAILED)`, nowMs() - start, meta);
    throw error;
  }
}

/**
 * Synchronous version of timed measurement.
 *
 * Usage:
 *   const items = timedSync('filterItems', () => items.filter(...));
 */
export function timedSync<T>(
  label: string,
  fn: () => T,
  meta?: Record<string, unknown>
): T {
  if (!__DEV__) return fn();

  const start = nowMs();
  const result = fn();
  logPerf(label, nowMs() - start, meta);
  return result;
}

const onProfilerRender: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime
) => {
  if (!__DEV__) return;

  logPerf(`profiler:${id}:${phase}`, actualDuration, {
    baseDuration: Math.round(baseDuration * 100) / 100,
    startTime: Math.round(startTime * 100) / 100,
    commitTime: Math.round(commitTime * 100) / 100,
  });
};

interface PerfProfilerProps {
  id: string;
  children: ReactNode;
}

export function PerfProfiler({ id, children }: PerfProfilerProps) {
  const normalizedChildren = Children.toArray(children).filter((child) => {
    if (typeof child !== 'string') {
      return true;
    }

    return child.trim().length > 0;
  });

  if (!isRenderProfilerEnabled()) {
    return createElement(Fragment, null, ...normalizedChildren);
  }

  return createElement(Profiler, { id, onRender: onProfilerRender }, ...normalizedChildren);
}
