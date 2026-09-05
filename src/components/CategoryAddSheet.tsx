/**
 * CategoryAddSheet (plan 016 follow-up) — the "add category" bottom sheet
 * opened from the expense form's "+" chip (which replaced the built-in
 * "Other" chip position). A name input + a curated icon grid + Save:
 * pure typing is the input here (short, single field), and the save path is
 * validated (empty name / duplicate surfaced inline; the service is the
 * source of truth — errors bubble to `error`).
 */
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/theme';
import { CATEGORY_ICON_CHOICES } from './categoryMeta';

export interface CategoryAddSheetProps {
  visible: boolean;
  /** Called with the validated (trimmed, non-empty) name + chosen icon. */
  onSave(name: string, icon: string): Promise<void> | void;
  onCancel(): void;
}

export function CategoryAddSheet({ visible, onSave, onCancel }: CategoryAddSheetProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>(CATEGORY_ICON_CHOICES[0] ?? 'grid-outline');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = (): void => {
    setName('');
    setIcon(CATEGORY_ICON_CHOICES[0] ?? 'grid-outline');
    setError(null);
    setSaving(false);
  };

  const onClose = (): void => {
    reset();
    onCancel();
  };

  const onSavePress = async (): Promise<void> => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter a category name');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(trimmed, icon);
      reset();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} accessibilityViewIsModal>
      <View style={styles.overlay}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={styles.card} testID="category-add-sheet">
          <Text style={styles.title} testID="category-add-title">
            Add category
          </Text>

          <Text style={styles.label} nativeID="category-add-label-name">
            Name
          </Text>
          <TextInput
            style={[styles.input, error && styles.inputError]}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Pets"
            placeholderTextColor={colors.muted}
            maxLength={24}
            autoFocus
            editable={!saving}
            accessibilityLabel="New category name"
            accessibilityLabelledBy="category-add-label-name"
            testID="category-add-name"
          />
          {error ? (
            <Text style={styles.fieldError} testID="category-add-error">
              {error}
            </Text>
          ) : null}

          <Text style={styles.label}>Icon</Text>
          <View style={styles.iconGrid}>
            {CATEGORY_ICON_CHOICES.map((choice) => {
              const selected = icon === choice;
              return (
                <Pressable
                  key={choice}
                  onPress={() => setIcon(choice)}
                  style={[styles.iconCell, selected && styles.iconSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${choice} icon${selected ? ', selected' : ''}`}
                  testID={`category-add-icon-${choice}`}
                >
                  <Ionicons name={choice as never} size={20} color={selected ? colors.surface : colors.muted} />
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => void onSavePress()}
            style={[styles.save, (saving || name.trim() === '') && styles.buttonDisabled]}
            disabled={saving || name.trim() === ''}
            accessibilityRole="button"
            testID="category-add-save"
          >
            <Text style={styles.saveLabel}>{saving ? 'Saving…' : 'Save category'}</Text>
          </Pressable>
          <Pressable
            onPress={onClose}
            style={styles.cancel}
            disabled={saving}
            accessibilityRole="button"
            testID="category-add-cancel"
          >
            <Text style={styles.cancelLabel}>Cancel</Text>
          </Pressable>
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
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  title: { fontSize: typography.emphasis, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
  label: { fontSize: typography.body, fontWeight: '600', color: colors.text, marginBottom: spacing.xs, marginTop: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    minHeight: 48,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: typography.body,
    color: colors.text,
    backgroundColor: colors.background,
  },
  inputError: { borderColor: colors.danger },
  fieldError: { marginTop: spacing.xs, color: colors.danger, fontSize: typography.caption },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  iconCell: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  iconSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  save: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  saveLabel: { color: '#fff', fontSize: typography.emphasis, fontWeight: '600' },
  cancel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    backgroundColor: colors.background,
  },
  cancelLabel: { color: colors.muted, fontSize: typography.emphasis, fontWeight: '600' },
  buttonDisabled: { opacity: 0.7 },
});