import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';

export type GlyphName =
  | 'home'
  | 'expenses'
  | 'due'
  | 'analytics'
  | 'plus'
  | 'ai'
  | 'settings'
  | 'search'
  | 'back'
  | 'chevron';

export interface GlyphProps {
  name: GlyphName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  testID?: string;
}

export function Glyph({
  name,
  size = 24,
  color,
  strokeWidth: _strokeWidth,
  testID,
}: GlyphProps) {
  const { colors } = useTheme();
  const iconColor = color ?? colors.text;

  const getIconName = (): keyof typeof Ionicons.glyphMap => {
    switch (name) {
      case 'home':
        return 'card-outline';
      case 'expenses':
        return 'receipt-outline';
      case 'due':
        return 'calendar-outline';
      case 'analytics':
        return 'bar-chart-outline';
      case 'plus':
        return 'add';
      case 'ai':
        return 'sparkles';
      case 'settings':
        return 'settings-outline';
      case 'search':
        return 'search';
      case 'back':
        return 'chevron-back';
      case 'chevron':
        return 'chevron-forward';
      default:
        return 'help-outline';
    }
  };

  return (
    <Ionicons
      name={getIconName()}
      size={size}
      color={iconColor}
      testID={testID}
    />
  );
}
