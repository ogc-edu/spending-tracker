/** Spacing scale. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,

  // Design tokens from design.jsonc
  screenX: 16,
  screenTopBelowSafeArea: 4,
  sectionGap: 20,
  sectionGapAnalytics: 16,
  sectionTitleToContent: 10,
  cardPaddingY: 14,
  cardPaddingX: 16,
  groupPaddingX: 14,
  rowGap: 12,
  chipGap: 8,
  scrollBottomPadding: 16,
} as const;

/** Border radius scale for modern curved surfaces. */
export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,

  // Design tokens from design.jsonc
  walletCard: 16,
  surface: 16,
  group: 14,
  sheetTop: 20,
  button: 14,
  optionTile: 12,
  dateTile: 10,
  categoryTile: 9,
  segmentTrack: 10,
  segmentThumb: 8,
  searchField: 10,
  chip: 9999,
  iconButton: 9999,
  barTop: 4,
  progress: 2,
} as const;

export const sizes = {
  minTouchTarget: 44,
  iconButton: 44,
  tabBarHeightExcludingInset: 64,
  fabInTabBar: 48,
  primaryButtonHeight: 52,
  sheetButtonHeight: 50,
  chipHeight: 36,
  filterPillHeight: 32,
  segmentHeight: 36,
  searchFieldHeight: 40,
  rowMinHeight: 52,
  commitmentRowMinHeight: 60,
  billRowMinHeight: 56,
  groupRowMinHeight: 48,
  accountRowMinHeight: 56,
  dateTile: 40,
  categoryTile: 34,
  accountSwatch: {
    w: 22,
    h: 15,
    radius: 3,
    settingsW: 30,
    settingsH: 20,
    settingsRadius: 4,
  },
  progressHeight: 4,
  chartHeight: 168,
  switch: { w: 51, h: 31, knob: 27 },
  iconStroke: 1.8,
  tabIcon: 22,
  headerIcon: 20,
} as const;

export const motion = {
  walletExpand: 220,
  sheet: 250,
} as const;

/** Soft layered elevation shadows for iOS & Android. */
export const shadows = {
  subtle: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  fab: {
    shadowColor: '#15803D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
  },
  hero: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 5,
  },
  walletCardDark: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 6,
  },
  walletCardLight: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;