# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## UI & Component Architecture (React Native)
- **UI System**: React Native Reusables (RNR) + NativeWind.
- **Component Source**: All core components must come from `@/components/ui/` (RNR primitives: button, dialog, input, select, card, avatar).
- **Styling Rules**:
  - Use NativeWind `className` attributes exclusively; do not use inline `style={{}}` unless computing dynamic runtime layout dimensions.
  - Follow subtle hairline borders (`border border-border`) instead of aggressive drop shadows.
  - Use proper mobile touch affordances: safe areas (`react-native-safe-area-context`), native bottom sheets for menus, and minimum 44px touch targets.
