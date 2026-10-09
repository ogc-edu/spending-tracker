/**
 * Plan 013 — /settings/ai/[provider]: renders the per-provider BYOK config
 * screen (ProviderConfigScreen) wired to the app's AiConfigService and an
 * AIService whose config resolvers come from that service. The UI touches
 * providers only through the AIService facade (plan ¶10).
 */
import { useMemo } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { repositories } from '@/db';
import { createAIService } from '@/ai/AIService';
import {
  AiConfigService,
  aiServiceOptions,
  type ConfigurableAIProvider,
} from '@/services/AiConfigService';
import { ProviderConfigScreen } from '@/components/ai/ProviderConfigScreen';
import { KeyboardScreen } from '@/components/KeyboardScreen';

export default function AiProviderConfigRoute() {
  const { provider } = useLocalSearchParams<{ provider: string }>();
  const { authService } = useAuth();

  const { config, service } = useMemo(() => {
    const repos = repositories();
    const cfg = new AiConfigService(repos.settings, authService);
    return { config: cfg, service: createAIService('fake', {}, aiServiceOptions(cfg)) };
  }, [authService]);

  // Defensive guard — only the Settings rows link here with a valid id.
  if (provider !== 'gemini' && provider !== 'deepseek') {
    return <Redirect href={'/settings' as never} />;
  }

  return (
    <KeyboardScreen>
      <ProviderConfigScreen
        provider={provider as ConfigurableAIProvider}
        config={config}
        service={service}
      />
    </KeyboardScreen>
  );
}