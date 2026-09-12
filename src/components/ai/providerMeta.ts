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

/**
 * Plan 016 — the AI status line ("Gemini · key configured / not
 * configured"). Pure so tests can pin it; the Settings screen renders one
 * line per provider from the SecureStore key presence (013's config).
 */
export function aiStatusLabel(provider: ConfigurableAIProvider, configured: boolean): string {
  return `${PROVIDER_LABELS[provider]} · key ${configured ? 'configured' : 'not configured'}`;
}