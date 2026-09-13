/**
 * ConfirmSheet (plan 016; plan 018 chrome) — the SINGLE destructive-confirm
 * implementation, now composed from the shared `Sheet` (grab handle, scrim
 * token, radius) + `Button` primitives. Gates every destructive write:
 * delete expense, un-pay a commitment payment, cancel a commitment,
 * delete/archive a commitment, clear a budget.
 *
 * Contract (unchanged):
 *  - `onConfirm` runs exactly once per visible session: while `busy` the
 *    confirm button is disabled (native) AND the handler re-checks `busy`
 *    (defense in depth), so a rapid second tap can never fire a second
 *    destructive write.
 *  - The sheet does NOT auto-close — the caller owns `visible` (it closes
 *    after the awaited write, keep it open to retry, etc.).
 *  - Buttons are ≥48pt (Button primitive) and carry roles/labels for screen
 *    readers; the sheet is accessibilityViewIsModal so focus stays inside.
 */
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';

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
    <Sheet
      visible={visible}
      onClose={onCancel}
      closeLabel="Close confirmation"
      cardTestID="confirm-sheet"
    >
      <Text style={styles.title} testID="confirm-sheet-title">
        {title}
      </Text>
      <Text style={styles.message} testID="confirm-sheet-message">
        {message}
      </Text>
      <View style={styles.actions}>
        <Button
          label={cancelLabel}
          variant="secondary"
          flex
          onPress={onCancel}
          disabled={busy}
          testID="confirm-sheet-cancel"
        />
        <Button
          label={confirmLabel}
          variant="danger"
          flex
          busy={busy}
          disabled={busy}
          onPress={() => {
            if (busy) return; // double-tap guard (belt + braces with disabled)
            onConfirm();
          }}
          testID="confirm-sheet-confirm"
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  message: { fontSize: typography.body, color: colors.muted, lineHeight: 21, marginBottom: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.md },
});
