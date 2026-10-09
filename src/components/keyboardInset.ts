/**
 * Keyboard geometry shared by the form scroller and the bottom sheets.
 *
 * Everything here is measured, never hard-coded: the keyboard's real height
 * comes from the Keyboard event, and what a container must give up is the
 * OVERLAP between the keyboard and that container's own measured frame — so
 * when the window already resized above the keyboard (classic Android
 * adjustResize) the overlap is 0 and nothing is added twice.
 */
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Keyboard, Platform, useWindowDimensions, type View } from 'react-native';

/** iOS animates with the *Will* pair; Android only emits the *Did* pair. */
export const KEYBOARD_SHOW_EVENT = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
export const KEYBOARD_HIDE_EVENT = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

/** Vertical frame (window coordinates) of a native node. */
export interface Frame {
  top: number;
  bottom: number;
}

/**
 * How much of a container the keyboard actually covers — 0 when the container
 * already ends above it (nothing to pad, no empty area).
 */
export function keyboardOverlap(containerBottom: number, keyboardTop: number): number {
  return Math.max(0, containerBottom - keyboardTop);
}

/**
 * Measure a node's vertical frame in window coordinates. Before the ref is
 * attached (or when the platform cannot measure it) the caller's fallback is
 * used, which for these full-height containers is the window itself.
 */
export function measureFrame(
  node: { measureInWindow?(cb: (x: number, y: number, w: number, h: number) => void): void } | null,
  fallback: Frame,
  onFrame: (frame: Frame) => void,
): void {
  if (node && typeof node.measureInWindow === 'function') {
    node.measureInWindow((_x, y, _w, height) => onFrame({ top: y, bottom: y + height }));
    return;
  }
  onFrame(fallback);
}

/**
 * The bottom inset a container needs while the keyboard is open — the covered
 * strip, 0 when it is closed.
 *
 * A bottom-anchored sheet applies it as `paddingBottom` on its full-screen
 * overlay: the card rides up by exactly the keyboard's height, keeping its
 * inputs in view on any device without a magic offset. `onShow` reports the
 * keyboard's top edge for callers that do their own geometry; `onHide` fires
 * when it closes.
 */
export function useKeyboardInset(
  containerRef: RefObject<View | null>,
  handlers: { onShow?(keyboardTop: number): void; onHide?(): void } = {},
): number {
  const { height: windowHeight } = useWindowDimensions();
  const [inset, setInset] = useState(0);
  // Kept in a ref so a caller's inline callbacks don't re-subscribe the
  // listeners on every render (the ref is written in an effect, not in render).
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const show = Keyboard.addListener(KEYBOARD_SHOW_EVENT, (event) => {
      const keyboardTop = windowHeight - event.endCoordinates.height;
      measureFrame(containerRef.current, { top: 0, bottom: windowHeight }, (container) => {
        setInset(keyboardOverlap(container.bottom, keyboardTop));
        handlersRef.current.onShow?.(keyboardTop);
      });
    });
    const hide = Keyboard.addListener(KEYBOARD_HIDE_EVENT, () => {
      setInset(0); // layout returns to normal — no leftover empty strip
      handlersRef.current.onHide?.();
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [containerRef, windowHeight]);

  return inset;
}
