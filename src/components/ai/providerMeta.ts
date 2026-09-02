/**
 * Plan 013 — provider display metadata for the Settings AI section.
 * `AI_PROVIDERS` (the BYOK set) comes from AiConfigService; labels/icons are
 * presentation-only.
 */
import type { ConfigurableAIProvider } from '@/services/AiConfigService';

export const PROVIDER_LABELS: Record<ConfigurableAIProvider, string> = {
  gemini: 'Gemini',
  deepseek: 'DeepSeek',
};

/** Ionicons name per provider (sparkles = the AI mark). */
export const PROVIDER_ICONS: Record<ConfigurableAIProvider, 'sparkles-outline' | 'sparkles'> = {
  gemini: 'sparkles',
  deepseek: 'sparkles-outline',
};