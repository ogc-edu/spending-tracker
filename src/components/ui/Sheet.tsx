import React, { useRef } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MIN_TOUCH_TARGET, geistWeights, useTheme } from '@/theme';
import { useKeyboardInset } from '../keyboardInset';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  showClose?: boolean;
  closeLabel?: string;
  titleTestID?: string;
  closeButtonTestID?: string;
  children: React.ReactNode;
  cardTestID?: string;
  style?: StyleProp<ViewStyle>;
}

export function Sheet({
  visible,
  onClose,
  title,
  showClose = false,
  closeLabel = 'Close',
  titleTestID,
  closeButtonTestID,
  children,
  cardTestID,
  style,
}: SheetProps) {
  const { colors } = useTheme();
  const overlayRef = useRef<View>(null);
  const keyboardInset = useKeyboardInset(overlayRef);

  if (!visible) return null;

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View
        ref={overlayRef}
        collapsable={false}
        style={[
          styles.overlay,
          {
            backgroundColor: colors.scrim,
            paddingBottom: keyboardInset,
          },
        ]}
      >
        <Pressable
          style={styles.scrim}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
        />
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.sheet,
            },
            style,
          ]}
          testID={cardTestID}
        >
          <View
            style={[
              styles.handle,
              {
                backgroundColor: colors.handle,
              },
            ]}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          {title ? (
            <View style={styles.titleRow}>
              <Text
                style={[
                  styles.title,
                  {
                    color: colors.text,
                  },
                ]}
                testID={titleTestID}
              >
                {title}
              </Text>
              {showClose ? (
                <Pressable
                  onPress={onClose}
                  style={styles.closeButton}
                  accessibilityRole="button"
                  accessibilityLabel={closeLabel}
                  testID={closeButtonTestID}
                >
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
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
    justifyContent: 'flex-end',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  card: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
    flexShrink: 1,
  },
  closeButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -8,
  },
});
