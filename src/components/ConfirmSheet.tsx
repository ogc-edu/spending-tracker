/**
 * ConfirmSheet (plan 016) — the SINGLE destructive-confirm implementation,
 * a minimal native bottom sheet (Modal over a dark scrim, no third-party
 * dialog library per plan §Decisions). Gates every destructive write:
 * delete expense, un-pay a commitment payment, cancel a commitment,
 * delete/archive a commitment, clear a budget.
 *
 * Contract:
 *  - `onConfirm` runs exactly once per visible session: while `busy` the
 *    confirm button is disabled (native) AND the handler re-checks `busy`
 *    (defense in depth), so a rapid second tap can never fire a second
 *    destructive write.
 *  - The sheet does NOT auto-close — the caller owns `visible` (it closes
 *    after the awaited write, keep it open to retry, etc.).
 *  - Buttons are ≥44pt (touchTarget) and carry roles/labels for screen
 *    readers; the sheet is accessibilityViewIsModal so focus stays inside.
 */
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, touchTarget, typography } from '@/theme';

export interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  message: string;
  /** The destructive action label — defaults to "Delete". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** While true (a write is in flight) the confirm button is disabled. */
  busy?: boolean;
  onConfirm(): void;
  onCancel(): void;
}

export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
      accessibilityViewIsModal
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.scrim}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Close confirmation"
        />
        <View style={styles.card} testID="confirm-sheet">
          <Text style={styles.title} testID="confirm-sheet-title">
            {title}
          </Text>
          <Text style={styles.message} testID="confirm-sheet-message">
            {message}
          </Text>
          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              disabled={busy}
              style={({ pressed }) => [styles.cancel, touchTarget, pressed && styles.pressed]}
              accessibilityRole="button"
              testID="confirm-sheet-cancel"
            >
              <Text style={styles.cancelLabel}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (busy) return; // double-tap guard (belt + braces with disabled)
                onConfirm();
              }}
              disabled={busy}
              style={({ pressed }) => [styles.confirm, touchTarget, busy && styles.confirmDisabled, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              testID="confirm-sheet-confirm"
            >
              <Text style={styles.confirmLabel}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  card: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: spacing.lg,
    borderTopRightRadius: spacing.lg,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  title: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  message: { fontSize: typography.body, color: colors.muted, lineHeight: 21, marginBottom: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.md },
  cancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  cancelLabel: { color: colors.text, fontSize: typography.emphasis, fontWeight: '600' },
  confirm: {
    flex: 1,
    backgroundColor: colors.danger,
    borderRadius: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDisabled: { opacity: 0.6 },
  confirmLabel: { color: colors.surface, fontSize: typography.emphasis, fontWeight: '700' },
  pressed: { opacity: 0.8 },
});