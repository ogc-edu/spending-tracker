import { Platform, Vibration } from 'react-native';

/**
 * Tactile Haptic Feedback Abstraction (Plan 010)
 * Safely triggers haptics on supported native environments with
 * zero crash risk in headless tests (Jest) or web.
 */
let ExpoHaptics: {
  selectionAsync?: () => Promise<void>;
  impactAsync?: (style: unknown) => Promise<void>;
  notificationAsync?: (type: unknown) => Promise<void>;
  ImpactFeedbackStyle?: { Light: unknown; Medium: unknown; Heavy: unknown };
  NotificationFeedbackType?: { Success: unknown; Warning: unknown; Error: unknown };
} | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ExpoHaptics = require('expo-haptics');
} catch {
  ExpoHaptics = null;
}

export const haptics = {
  /** Keypad digit press: SelectionAsync (Light) */
  keypadPress(): void {
    if (Platform.OS === 'web') return;
    try {
      if (ExpoHaptics?.selectionAsync) {
        void ExpoHaptics.selectionAsync();
      } else {
        Vibration.vibrate(1);
      }
    } catch {
      // graceful no-op
    }
  },

  /** Category selection: ImpactFeedbackStyle.Light */
  categorySelect(): void {
    if (Platform.OS === 'web') return;
    try {
      if (ExpoHaptics?.impactAsync && ExpoHaptics.ImpactFeedbackStyle) {
        void ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light);
      } else {
        Vibration.vibrate(5);
      }
    } catch {
      // graceful no-op
    }
  },

  /** Commitment mark as paid: NotificationFeedbackType.Success */
  paymentSuccess(): void {
    if (Platform.OS === 'web') return;
    try {
      if (ExpoHaptics?.notificationAsync && ExpoHaptics.NotificationFeedbackType) {
        void ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Success);
      } else {
        Vibration.vibrate([0, 10, 50, 15]);
      }
    } catch {
      // graceful no-op
    }
  },

  /** Budget limit reached / warning: NotificationFeedbackType.Warning */
  budgetAlert(): void {
    if (Platform.OS === 'web') return;
    try {
      if (ExpoHaptics?.notificationAsync && ExpoHaptics.NotificationFeedbackType) {
        void ExpoHaptics.notificationAsync(ExpoHaptics.NotificationFeedbackType.Warning);
      } else {
        Vibration.vibrate([0, 15, 60, 25]);
      }
    } catch {
      // graceful no-op
    }
  },

  /** Transaction deletion: ImpactFeedbackStyle.Medium */
  deleteConfirm(): void {
    if (Platform.OS === 'web') return;
    try {
      if (ExpoHaptics?.impactAsync && ExpoHaptics.ImpactFeedbackStyle) {
        void ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Medium);
      } else {
        Vibration.vibrate(15);
      }
    } catch {
      // graceful no-op
    }
  },
};
