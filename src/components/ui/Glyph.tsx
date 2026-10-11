import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
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
  strokeWidth = 1.8,
  testID,
}: GlyphProps) {
  const { colors } = useTheme();
  const stroke = color ?? colors.text;

  const renderContent = () => {
    switch (name) {
      case 'home':
        return (
          <>
            <Rect
              x={3}
              y={6}
              width={18}
              height={13}
              rx={3}
              stroke={stroke}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M3 10h18"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M6 3h12"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        );

      case 'expenses':
        return (
          <>
            <Path
              d="M8 6h13M8 12h13M8 18h13"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Circle cx={3.5} cy={6} r={1} fill={stroke} />
            <Circle cx={3.5} cy={12} r={1} fill={stroke} />
            <Circle cx={3.5} cy={18} r={1} fill={stroke} />
          </>
        );

      case 'due':
        return (
          <>
            <Rect
              x={3}
              y={5}
              width={18}
              height={16}
              rx={3}
              stroke={stroke}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M3 10h18M8 3v4M16 3v4"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        );

      case 'analytics':
        return (
          <Path
            d="M5 20V12M12 20V5M19 20v-9"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'plus':
        return (
          <Path
            d="M12 5v14M5 12h14"
            stroke={stroke}
            strokeWidth={strokeWidth ?? 2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'ai':
        return (
          <>
            <Path
              d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"
              stroke={stroke}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z"
              stroke={stroke}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        );

      case 'settings':
        return (
          <>
            <Circle
              cx={12}
              cy={12}
              r={3}
              stroke={stroke}
              strokeWidth={strokeWidth}
              fill="none"
            />
            <Path
              d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
              stroke={stroke}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        );

      case 'search':
        return (
          <>
            <Circle
              cx={11}
              cy={11}
              r={7}
              stroke={stroke}
              strokeWidth={strokeWidth ?? 2}
              fill="none"
            />
            <Path
              d="M20 20l-3.5-3.5"
              stroke={stroke}
              strokeWidth={strokeWidth ?? 2}
              strokeLinecap="round"
            />
          </>
        );

      case 'back':
        return (
          <Path
            d="M15 5l-7 7 7 7"
            stroke={stroke}
            strokeWidth={strokeWidth ?? 2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'chevron':
        return (
          <Path
            d="M9 5l7 7-7 7"
            stroke={stroke}
            strokeWidth={strokeWidth ?? 2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      default:
        return null;
    }
  };

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      testID={testID}
    >
      {renderContent()}
    </Svg>
  );
}
