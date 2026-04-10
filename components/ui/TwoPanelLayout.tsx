import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useLayout } from '@/hooks/use-layout';

interface TwoPanelLayoutProps {
  leftPanel: ReactNode;
  rightPanel: ReactNode;
  className?: string;
}

/**
 * Responsive two-panel (split) layout.
 * - Tablet: left panel at 38% width + right panel fills remaining space.
 * - Phone: shows rightPanel when provided, otherwise leftPanel.
 */
export function TwoPanelLayout({ leftPanel, rightPanel, className = '' }: TwoPanelLayoutProps) {
  const { isPhone } = useLayout();

  if (isPhone) {
    return (
      <View className={`flex-1 bg-surface ${className}`}>
        {rightPanel ?? leftPanel}
      </View>
    );
  }

  return (
    <View className={`flex-1 flex-row bg-surface ${className}`}>
      <View className="w-[38%] border-r border-border bg-surface-card">
        {leftPanel}
      </View>
      <View className="flex-1">
        {rightPanel}
      </View>
    </View>
  );
}
