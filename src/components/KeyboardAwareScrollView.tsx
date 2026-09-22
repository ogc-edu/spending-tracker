/**
 * KeyboardAwareScrollView — a form ScrollView that keeps the FOCUSED input
 * above the soft keyboard.
 *
 * Why this exists next to KeyboardScreen: KeyboardAvoidingView only shrinks
 * the container, it never scrolls the focused field into view, so a field near
 * the bottom (the expense Description) still ends up behind the keyboard —
 * and on Android's edge-to-edge window (Expo 57 default) the system resize no
 * longer does it either.
 *
 * Everything here is measured, never hard-coded:
 *  - the keyboard's real height comes from the Keyboard event's endCoordinates;
 *  - the covered strip is the overlap between the keyboard and this scroll
 *    view's own measured frame, so when the window DID resize (classic
 *    adjustResize) the overlap is 0 and no padding is added — no empty gap;
 *  - the scroll correction is the measured distance the focused input's bottom
 *    edge pokes below the visible area, so nothing moves when it already fits
 *    (the user's scroll position is preserved).
 *
 * Inputs announce their focus through `useKeyboardAwareFocus()` — the hook is
 * a no-op outside a provider, so forms still render anywhere.
 */
import { createContext, useCallback, useContext, useRef } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, spacing } from '@/theme';
import { measureFrame, useKeyboardInset } from './keyboardInset';

// The shared geometry lives in ./keyboardInset; re-exported here because this
// is the module form screens (and their tests) already import.
export { keyboardOverlap } from './keyboardInset';

/** Breathing room kept between the focused input and the keyboard (a spacing token, not a device offset). */
const GAP = spacing.lg;

export interface FocusGeometry {
  /** Scroll view frame in window coordinates. */
  scrollTop: number;
  scrollBottom: number;
  /** Focused input frame in window coordinates. */
  inputTop: number;
  inputBottom: number;
  /** Top edge of the keyboard in window coordinates. */
  keyboardTop: number;
  /** Current vertical content offset. */
  offset: number;
  gap?: number;
}

/**
 * The content offset that brings the focused input fully into the strip left
 * visible by the keyboard — or null when it is already visible, which is what
 * keeps the view from jumping on every focus.
 */
export function scrollOffsetFor({
  scrollTop,
  scrollBottom,
  inputTop,
  inputBottom,
  keyboardTop,
  offset,
  gap = GAP,
}: FocusGeometry): number | null {
  const visibleBottom = Math.min(scrollBottom, keyboardTop) - gap;
  const visibleTop = scrollTop + gap;
  if (inputBottom > visibleBottom) {
    // Scroll just enough — and never so far that the input's own top is pushed
    // off the top edge (a field taller than the strip aligns to the top).
    const shift = Math.min(inputBottom - visibleBottom, Math.max(0, inputTop - visibleTop));
    return shift > 0 ? offset + shift : null;
  }
  if (inputTop < visibleTop) {
    return Math.max(0, offset - (visibleTop - inputTop));
  }
  return null;
}

const FocusContext = createContext<() => void>(() => {});

/** Call this from an input's `onFocus` so the scroller can reveal it. */
export function useKeyboardAwareFocus(): () => void {
  return useContext(FocusContext);
}

export interface KeyboardAwareScrollViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Passed straight to the inner ScrollView (dashboard pull-to-refresh). */
  refreshControl?: React.ReactElement<RefreshControlProps>;
  testID?: string;
}

export function KeyboardAwareScrollView({
  children,
  style,
  contentContainerStyle,
  refreshControl,
  testID,
}: KeyboardAwareScrollViewProps) {
  const { height: windowHeight } = useWindowDimensions();
  const containerRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const offsetRef = useRef(0);
  const keyboardTopRef = useRef(Number.POSITIVE_INFINITY);

  /** Measure the focused input against the visible strip and correct the offset. */
  const revealFocusedInput = useCallback(() => {
    const input = TextInput.State.currentlyFocusedInput();
    if (!input || keyboardTopRef.current === Number.POSITIVE_INFINITY) return;
    measureFrame(containerRef.current, { top: 0, bottom: windowHeight }, (container) => {
      input.measureInWindow((_ix, iy, _iw, ih) => {
        const next = scrollOffsetFor({
          scrollTop: container.top,
          scrollBottom: container.bottom,
          inputTop: iy,
          inputBottom: iy + ih,
          keyboardTop: keyboardTopRef.current,
          offset: offsetRef.current,
        });
        if (next !== null) {
          scrollRef.current?.scrollTo({ y: next, animated: true });
        }
      });
    });
  }, [windowHeight]);

  // The covered strip becomes bottom padding, so the last field has somewhere
  // to scroll to; the callback then lifts whatever is focused into view.
  const inset = useKeyboardInset(containerRef, {
    onShow: (keyboardTop) => {
      keyboardTopRef.current = keyboardTop;
      revealFocusedInput();
    },
    // Closed: no strip to avoid, so a later focus scrolls nothing.
    onHide: () => {
      keyboardTopRef.current = Number.POSITIVE_INFINITY;
    },
  });

  return (
    <FocusContext.Provider value={revealFocusedInput}>
      <View ref={containerRef} style={[styles.container, style]} collapsable={false}>
        <ScrollView
          ref={scrollRef}
          style={styles.container}
          contentContainerStyle={[contentContainerStyle, inset > 0 && { paddingBottom: inset + GAP }]}
          onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
            offsetRef.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          // Taps on chips/buttons work on the first tap while the keyboard is up.
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          refreshControl={refreshControl}
          testID={testID}
        >
          {children}
        </ScrollView>
      </View>
    </FocusContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});
