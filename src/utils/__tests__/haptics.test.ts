import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { Platform, Vibration } from 'react-native';
import { haptics } from '../haptics';

describe('haptics utility', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {});
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatform, writable: true });
  });

  it('triggers vibration fallback on native platform when expo-haptics is not loaded', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });

    expect(() => haptics.keypadPress()).not.toThrow();
    expect(Vibration.vibrate).toHaveBeenCalledWith(1);

    expect(() => haptics.categorySelect()).not.toThrow();
    expect(Vibration.vibrate).toHaveBeenCalledWith(5);

    expect(() => haptics.paymentSuccess()).not.toThrow();
    expect(Vibration.vibrate).toHaveBeenCalledWith([0, 10, 50, 15]);

    expect(() => haptics.budgetAlert()).not.toThrow();
    expect(Vibration.vibrate).toHaveBeenCalledWith([0, 15, 60, 25]);

    expect(() => haptics.deleteConfirm()).not.toThrow();
    expect(Vibration.vibrate).toHaveBeenCalledWith(15);
  });

  it('safely no-ops on web platform', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });

    haptics.keypadPress();
    haptics.categorySelect();
    haptics.paymentSuccess();
    haptics.budgetAlert();
    haptics.deleteConfirm();

    expect(Vibration.vibrate).not.toHaveBeenCalled();
  });
});
