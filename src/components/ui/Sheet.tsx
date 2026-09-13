/**
 * Sheet (plan 018) — the ONE bottom-modal chrome every sheet composes from:
 * Modal (slide) + scrim + grab handle + rounded card. Replaces the overlay/
 * scrim/card style blocks that ConfirmSheet, CalendarSheet, PaymentFlowSheet,
 * AccountBalanceSheet, PayrollAllocationSheet, CategoryAddSheet and the
 * budgets BudgetForm modal each duplicated (with drifting radii, scrim
 * colors and padding).
 *
 * Keyboard lift is built in: `useKeyboardInset` pads the overlay so the card
 * rides above the soft keyboard (the pattern AccountBalanceSheet and
 * PayrollAllocationSheet already measured per-sheet).
 *
 * Contracts that stay with the CALLER: busy guards, testIDs (pass `testID`
 * for the card), onRequestClose behavior (this component wires the Modal's
 * back-button close to `onClose`, the scrim tap too).
 */
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { MIN_TOUCH_TARGET, colors, radius, spacing, typography } from '@/theme';
import { useKeyboardInset } from '../keyboardInset';

export interface SheetProps {
  visible: boolean;
  /** Scrim tap + Android back button. */
  onClose(): void;
  /** Optional title row. */
  title?: string;
  /** Render an ✕ close button beside the title (CalendarSheet pattern). */
  showClose?: boolean;
  /** Accessibility label for the scrim tap ("Close confirmation"). */
  closeLabel?: string;
  /** Plan 018: keep the sheets' own title/close testIDs stable. */
  titleTestID?: string;
  closeButtonTestID?: string;
  children: React.ReactNode;
  /** Applied to the card View (NOT the component element — react-test-
   *  renderer's findAllByProps matches component props too, so keeping the
   *  id off the component keeps "hidden ⇒ no testID in tree" true). */
  cardTestID?: string;
}

export function Sheet({ visible, onClose, title, showClose = false, closeLabel = 'Close', titleTestID, closeButtonTestID, children, cardTestID }: SheetProps) {
  const overlayRef = useRef<View>(null);
  const keyboardInset = useKeyboardInset(overlayRef);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} accessibilityViewIsModal>
      <View ref={overlayRef} collapsable={false} style={[styles.overlay, { paddingBottom: keyboardInset }]}>
        <Pressable
          style={styles.scrim}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
        />
        <View style={styles.card} testID={cardTestID}>
          <View style={styles.handle} accessibilityElementsHidden importantForAccessibility="no" />
          {title ? (
            <View style={styles.titleRow}>
              <Text style={styles.title} testID={titleTestID}>{title}</Text>
              {showClose ? (
                <Pressable
                  onPress={onClose}
                  style={styles.closeButton}
                  accessibilityRole="button"
                  accessibilityLabel={closeLabel}
                  testID={closeButtonTestID}
                >
                  <Ionicons name="close" size={22} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'flex-end',
  },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  card: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  title: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text, flexShrink: 1 },
  closeButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.md,
  },
});
