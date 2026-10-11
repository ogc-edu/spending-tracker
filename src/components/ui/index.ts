// Wave 1A New UI Primitives (design.jsonc)
export { Glyph, type GlyphName, type GlyphProps } from './Glyph';
export { IconButton, type IconButtonProps, type IconButtonTone } from './IconButton';
export { PrimaryButton, type PrimaryButtonProps } from './PrimaryButton';
export { TextLinkButton, type TextLinkButtonProps } from './TextLinkButton';
export { Chip, type ChipProps } from './Chip';
export { FilterPill, type FilterPillProps } from './FilterPill';
export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentOption,
} from './SegmentedControl';
export { Switch, type SwitchProps } from './Switch';
export { Stepper, type StepperProps } from './Stepper';
export {
  AccountSwatch,
  type AccountSwatchProps,
  type AccountCardType,
} from './AccountSwatch';
export { OptionTile, type OptionTileProps } from './OptionTile';
export { Surface, type SurfaceProps } from './Surface';
export {
  FormGroup,
  type FormGroupProps,
  FormRow,
  type FormRowProps,
} from './FormGroup';
export {
  SettingsGroup,
  type SettingsGroupProps,
  SettingsRow,
  type SettingsRowProps,
} from './SettingsGroup';
export { SearchField, type SearchFieldProps } from './SearchField';
export { DateTile, type DateTileProps } from './DateTile';
export { CategoryTile, type CategoryTileProps } from './CategoryTile';
export { DueRow, type DueRowProps } from './DueRow';
export { ExpenseRow, type ExpenseRowProps } from './ExpenseRow';
export { DayHeader, type DayHeaderProps } from './DayHeader';
export { BreakdownRow, type BreakdownRowProps } from './BreakdownRow';
export { Sheet, type SheetProps } from './Sheet';
export { Toast, type ToastProps } from './Toast';
export { EmptyState, type EmptyStateProps } from './EmptyState';
export { BarChart, type BarChartProps, type BarChartItem } from './BarChart';
export {
  WalletCard,
  type WalletCardProps,
  type WalletCardLine,
} from './WalletCard';
export {
  WalletStack,
  type WalletStackProps,
  type WalletCardData,
} from './WalletStack';
export {
  CreditAccountCard,
  type CreditAccountCardProps,
  type CreditBillItem,
} from './CreditAccountCard';
export { TabBar, type TabBarProps, type TabItem, TAB_ITEMS } from './TabBar';
export {
  ScreenTitleBlock,
  type ScreenTitleBlockProps,
} from './ScreenTitleBlock';
export {
  SummaryStrip,
  type SummaryStripProps,
  type SummaryStripHomeProps,
  type SummaryStripDueProps,
} from './SummaryStrip';
export { Money, type MoneyProps, type MoneySize } from './Money';

// Legacy UI Component Primitives (preserved for existing screen compatibility)
export { MoneyDisplay, type MoneyDisplayProps, type MoneyDisplaySize } from './MoneyDisplay';
export { StatusPill, type StatusPillProps, type StatusVariant } from './StatusPill';
export { BudgetMeter, type BudgetMeterProps } from './BudgetMeter';
export { BentoCard, type BentoCardProps } from './BentoCard';
export { TouchTarget, type TouchTargetProps } from './TouchTarget';
export { Avatar, AvatarFallback, AvatarImage } from './avatar';
export { Badge, type BadgeTone } from './Badge';
export {
  Button,
  buttonTextVariants,
  buttonVariants,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
} from './Button';
export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardLabel,
  CardTitle,
  type CardProps,
  type CardTone,
} from './Card';
export { Fab } from './Fab';
export { Icon } from './icon';
export { InlineError } from './InlineError';
export { Input } from './input';
export { List, ListRow, RowIcon, SectionLabel, type ListRowProps } from './List';
export { SectionHeader } from './SectionHeader';
export {
  SkeletonCard,
  SkeletonGrid,
  SkeletonHome,
  SkeletonRow,
} from './Skeleton';
export { Text, TextClassContext } from './text';
