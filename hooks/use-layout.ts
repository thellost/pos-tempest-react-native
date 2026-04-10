import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

export interface LayoutInfo {
  isPhone: boolean;
  isTablet: boolean;
  isPortrait: boolean;
  isLandscape: boolean;
  screenWidth: number;
  screenHeight: number;
  columns: (minWidth: number) => number;
}

export function useLayout(): LayoutInfo {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const isPhone = width < 768;
    const isTablet = width >= 768;
    const isPortrait = height > width;
    const isLandscape = width >= height;

    return {
      isPhone,
      isTablet,
      isPortrait,
      isLandscape,
      screenWidth: width,
      screenHeight: height,
      columns: (minWidth: number) => Math.max(1, Math.floor(width / minWidth)),
    };
  }, [width, height]);
}
