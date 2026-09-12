/**
 * MoneyInput — POS/cash-terminal style amount entry.
 *
 * The field starts at RM0.00 and reads every keystroke as a sen digit pushed
 * in from the right: 2 → 0 → 0 gives RM0.02 → RM0.20 → RM2.00, and backspace
 * shifts back the same way. There is no decimal point to type (number-pad
 * keyboard), so a malformed amount — two dots, three decimals, a stray minus —
 * cannot be entered at all; the reducer lives in `senFromInputText`.
 *
 * WHY THE INPUT IS INVISIBLE: a controlled TextInput paints the raw keystroke
 * ("RM0.007") for a frame before the re-render reformats it to "RM0.07" —
 * visible as a flicker on every key. So the TextInput holds plain digits and is
 * transparent; what the user sees is the formatted <Text> beside it, which only
 * ever renders a well-formed amount. The Pressable hands focus to the input, so
 * tapping anywhere on the field opens the keyboard as usual.
 *
 * Until a digit is entered the RM0.00 is rendered muted (a placeholder, not a
 * value), and while the field has focus a blinking caret sits after the amount
 * so the formatted Text still reads as something being typed into.
 *
 * The value crossing the props boundary stays the canonical form string
 * ("2.00", via formatSenInput), so callers keep the existing Zod money
 * grammar, parseMoneyToSen and the service boundary unchanged.
 */
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  formatSen,
  formatSenInput,
  senFromInputText,
  senFromMoneyString,
  spokenMoneyLabel,
} from '@/utils/money';
import { colors, spacing, typography } from '@/theme';

export interface MoneyInputProps {
  /** Canonical money string, e.g. "" or "2.00". */
  value: string;
  onChangeValue(next: string): void;
  onBlur?(): void;
  onFocus?(): void;
  editable?: boolean;
  autoFocus?: boolean;
  hasError?: boolean;
  accessibilityLabel?: string;
  accessibilityLabelledBy?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function MoneyInput({
  value,
  onChangeValue,
  onBlur,
  onFocus,
  editable = true,
  autoFocus = false,
  hasError = false,
  accessibilityLabel,
  accessibilityLabelledBy,
  testID,
  style,
}: MoneyInputProps) {
  const inputRef = useRef<TextInput>(null);
  const sen = senFromMoneyString(value);
  const digits = String(sen); // what the hidden buffer holds: "0", "7", "200"…
  const empty = sen === 0; // nothing entered yet → RM0.00 is a placeholder
  const [focused, setFocused] = useState(false);

  // Caret blink — the usual ~half-second cadence, native-driven so it costs no
  // re-renders, and stopped (and reset visible) as soon as focus leaves.
  const [caretOpacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!focused) return;
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(caretOpacity, { toValue: 0, duration: 0, delay: 500, useNativeDriver: true }),
        Animated.timing(caretOpacity, { toValue: 1, duration: 0, delay: 500, useNativeDriver: true }),
      ]),
    );
    blink.start();
    return () => {
      blink.stop();
      caretOpacity.setValue(1);
    };
  }, [caretOpacity, focused]);

  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      disabled={!editable}
      accessible={false}
      style={[styles.wrap, hasError && styles.wrapError, !editable && styles.wrapDisabled, style]}
    >
      <View style={styles.displayRow}>
        <Text
          style={[styles.display, empty && styles.displayEmpty]}
          testID={testID ? `${testID}-display` : undefined}
        >
          {formatSen(sen)}
        </Text>
        {focused ? (
          <Animated.View
            style={[styles.caret, { opacity: caretOpacity }]}
            accessibilityElementsHidden
            importantForAccessibility="no"
            testID={testID ? `${testID}-caret` : undefined}
          />
        ) : null}
      </View>
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        keyboardType="number-pad"
        inputMode="numeric"
        value={digits}
        // Caret and text are invisible; the formatted Text above is the field.
        caretHidden
        selection={{ start: digits.length, end: digits.length }}
        onChangeText={(text) => {
          onChangeValue(formatSenInput(senFromInputText(sen, text)));
        }}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        onFocus={() => {
          setFocused(true);
          onFocus?.();
        }}
        autoFocus={autoFocus}
        editable={editable}
        autoCorrect={false}
        spellCheck={false}
        selectTextOnFocus={false}
        contextMenuHidden
        accessibilityLabel={accessibilityLabel}
        accessibilityLabelledBy={accessibilityLabelledBy}
        accessibilityValue={{ text: spokenMoneyLabel(sen) }}
        testID={testID}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 56, // the amount is the primary field — taller than the 44pt minimum
  },
  wrapError: { borderColor: colors.danger },
  wrapDisabled: { backgroundColor: colors.background },
  displayRow: { flexDirection: 'row', alignItems: 'center' },
  display: {
    fontSize: typography.title,
    fontWeight: '700',
    color: colors.text,
  },
  /** No digits yet: the RM0.00 reads as a placeholder. */
  displayEmpty: { color: colors.muted, fontWeight: '600' },
  /** The "|" the user is typing against. */
  caret: {
    width: 2,
    height: typography.title + 4,
    marginLeft: 2,
    borderRadius: 1,
    backgroundColor: colors.accent,
  },
  /** Covers the field so taps land on it, but paints nothing. */
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    color: 'transparent',
    opacity: 0,
    fontSize: typography.title,
    padding: 0,
  },
});
