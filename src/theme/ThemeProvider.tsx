import React, { createContext, useContext, useState } from 'react';
import { useColorScheme } from 'react-native';
import { themes, type ThemeTokens } from './colors';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ThemeScheme = 'light' | 'dark';

export interface ThemeContextValue {
  mode: ThemeMode;
  scheme: ThemeScheme;
  colors: ThemeTokens;
  setMode: (mode: ThemeMode) => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  scheme: 'dark',
  colors: themes.dark,
  setMode: () => {},
});

export interface ThemeProviderProps {
  children: React.ReactNode;
  initialMode?: ThemeMode;
  onModeChange?: (mode: ThemeMode) => void;
}

export function ThemeProvider({
  children,
  initialMode = 'dark',
  onModeChange,
}: ThemeProviderProps) {
  const [internalMode, setInternalMode] = useState<ThemeMode>(initialMode);
  const [prevInitialMode, setPrevInitialMode] = useState<ThemeMode>(initialMode);
  const systemScheme = useColorScheme();

  if (initialMode !== prevInitialMode) {
    setPrevInitialMode(initialMode);
    setInternalMode(initialMode);
  }

  const setMode = (newMode: ThemeMode) => {
    setInternalMode(newMode);
    onModeChange?.(newMode);
  };

  const scheme: ThemeScheme =
    internalMode === 'system'
      ? systemScheme === 'light'
        ? 'light'
        : 'dark'
      : internalMode === 'light'
        ? 'light'
        : 'dark';

  const colors = themes[scheme];

  return (
    <ThemeContext.Provider value={{ mode: internalMode, scheme, colors, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
