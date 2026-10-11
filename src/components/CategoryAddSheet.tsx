import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { geistWeights, useTheme } from '@/theme';
import { CATEGORY_ICON_CHOICES } from './categoryMeta';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';

export interface CategoryAddSheetProps {
  visible: boolean;
  /** Called with the validated (trimmed, non-empty) name + chosen icon. */
  onSave(name: string, icon: string): Promise<void> | void;
  onCancel(): void;
}

export function CategoryAddSheet({ visible, onSave, onCancel }: CategoryAddSheetProps) {
  const { colors } = useTheme();
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
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Add category"
      titleTestID="category-add-title"
      closeLabel="Close"
      cardTestID="category-add-sheet"
    >
      <Text style={[styles.label, { color: colors.text }]} nativeID="category-add-label-name">
        Name
      </Text>
      <Input
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.fill,
            borderColor: error ? colors.danger : colors.separator,
          },
        ]}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Pets"
        placeholderTextColor={colors.textTertiary}
        maxLength={24}
        autoFocus
        editable={!saving}
        accessibilityLabel="New category name"
        accessibilityLabelledBy="category-add-label-name"
        testID="category-add-name"
      />
      {error ? (
        <Text style={[styles.fieldError, { color: colors.danger }]} testID="category-add-error">
          {error}
        </Text>
      ) : null}

      <Text style={[styles.label, { color: colors.text }]}>Icon</Text>
      <View style={styles.iconGrid}>
        {CATEGORY_ICON_CHOICES.map((choice) => {
          const selected = icon === choice;
          return (
            <Pressable
              key={choice}
              onPress={() => setIcon(choice)}
              style={[
                styles.iconCell,
                {
                  backgroundColor: selected ? colors.accent : colors.fill,
                  borderColor: selected ? colors.accent : colors.separator,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${choice} icon${selected ? ', selected' : ''}`}
              testID={`category-add-icon-${choice}`}
            >
              <Ionicons
                name={choice as never}
                size={20}
                color={selected ? colors.onAccent : colors.textTertiary}
              />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.buttonRow}>
        <Button
          label="Save category"
          variant="primary"
          busy={saving}
          disabled={saving || name.trim() === ''}
          onPress={() => void onSavePress()}
          testID="category-add-save"
        />
        <Button
          label="Cancel"
          variant="secondary"
          disabled={saving}
          onPress={onClose}
          testID="category-add-cancel"
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    fontFamily: geistWeights.regular,
  },
  fieldError: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: geistWeights.regular,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  iconCell: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRow: {
    gap: 8,
    marginTop: 8,
    paddingBottom: 8,
  },
});