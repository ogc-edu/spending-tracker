/**
 * ToastProvider (plan 016 / ARCH §11 "Write failures → user-visible toast")
 * — the ONE transient error surface for write failures (delete/save/etc.).
 * Properties (plan §Decisions): transient ≈2.5 s, non-modal (pointerEvents
 * none — never blocks a tap), one at a time (a new show replaces the
 * current toast and resets the timer).
 *
 * AI errors explicitly do NOT go here — they stay inline in their cards
 * (013/014/015); only application write failures toast.
 *
 * Safe-area-aware: floats above the bottom inset (notch / home indicator).
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '@/theme';

export const TOAST_DURATION_MS = 2500;

export interface ToastApi {
  /** Show a transient toast, replacing any visible one. */
  show(message: string): void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** The visible toast; id lets a rapid second show replace the first cleanly. */
interface ToastState {
  id: number;
  message: string;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);
  // useState initializer creates the Animated.Value once, stably (the
  // react-compiler refs rule forbids reading useRef().current during render).
  const [opacity] = useState(() => new Animated.Value(0));

  const show = useCallback((message: string) => {
    idRef.current += 1;
    setToast({ id: idRef.current, message });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  // Fade in on appearance (system-minimal, no extra animation libs).
  useEffect(() => {
    if (toast) {
      opacity.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    }
  }, [toast, opacity]);

  // Clear the pending dismissal timer when the provider unmounts.
  useEffect(() => {
    const timer = timerRef.current;
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.toast, { bottom: insets.bottom + spacing.lg, opacity }]}
          testID="toast-message"
        >
          <Text style={styles.text}>{toast.message}</Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used within a ToastProvider');
  return api;
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: colors.text,
    borderRadius: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  text: { color: colors.surface, fontSize: typography.body, fontWeight: '600', textAlign: 'center' },
});