import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useLayout } from '@/hooks/use-layout';

interface ResponsiveContainerProps {
  children: ReactNode;
  /** Layout direction on tablet (default: 'row') */
  tabletLayout?: 'row' | 'col';
  /** Layout direction on phone (default: 'col') */
  phoneLayout?: 'row' | 'col';
  className?: string;
}

export function ResponsiveContainer({
  children,
  tabletLayout = 'row',
  phoneLayout = 'col',
  className,
}: ResponsiveContainerProps) {
  const { isTablet } = useLayout();
  const layout = isTablet ? tabletLayout : phoneLayout;
  const flexDirection = layout === 'row' ? 'flex-row' : 'flex-col';

  return (
    <View className={`flex-1 ${flexDirection} ${className ?? ''}`}>
      {children}
    </View>
  );
}
