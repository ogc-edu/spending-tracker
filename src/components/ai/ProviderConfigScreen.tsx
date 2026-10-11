/**
 * Plan 013 — ProviderConfigScreen: per-provider BYOK configuration (PRD AI-6..10).
 * Restyled to SettingsGroup + theme tokens for new UI design system.
 *
 * Flow: masked key field (paste/add/replace) → Test Connection (distinct
 * ✓/✕ results, never the raw credential) → discovered model picker, or a
 * manual model-ID entry when discovery fails but the key is valid. The active
 * provider is chosen on the Settings screen, among configured providers only.
 *
 * Keys live ONLY in component state while editing and are written straight to
 * SecureStore on save (plan §Requirements). The stored key is held transiently
 * in memory for test/discovery calls — never rendered, never logged.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AIService } from '@/ai/AIService';
import type { ModelInfo, TestResult, TestStep } from '@/ai/types';
import type { AiConfigService, ConfigurableAIProvider } from '@/services/AiConfigService';
import { geistWeights, useTheme } from '@/theme';
import { SettingsGroup } from '@/components/ui/SettingsGroup';
import { maskKeySuffix } from './ProviderRow';
import { PROVIDER_LABELS } from './providerMeta';
import { ModelPicker } from './ModelPicker';
import { TestResultBadge } from './TestResultBadge';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Human label for a live Test Connection step (why it can take a while). */
function stepLabel(step: TestStep): string {
  switch (step.phase) {
    case 'discovering':
      return 'Discovering available models…';
    case 'testing':
      return `Testing ${step.modelId}…`;
    case 'unavailable':
      return `${step.modelId} unavailable — trying next…`;
  }
}

export function ProviderConfigScreen({
  provider,
  config,
  service,
}: {
  provider: ConfigurableAIProvider;
  config: AiConfigService;
  /** The AIService facade — the UI never calls providers directly (plan ¶10). */
  service: Pick<AIService, 'testConnection' | 'listModels'>;
}) {
  const { colors } = useTheme();

  const [keyText, setKeyText] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [storedKey, setStoredKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testStep, setTestStep] = useState<TestStep | null>(null);
  const [testStopped, setTestStopped] = useState(false);
  const testAbortRef = useRef<AbortController | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [discoveryFailed, setDiscoveryFailed] = useState(false);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [model, setModel] = useState<string | null>(null);
  const [manualId, setManualId] = useState('');
  const [removing, setRemoving] = useState(false);
  const [ready, setReady] = useState(false);

  const providerLabel = PROVIDER_LABELS[provider];
  /** Discovery failure only degrades to manual entry when the key itself tested OK. */
  const showManual = discoveryFailed && testResult?.ok === true;

  /** Refresh the discovered model list with the given key. */
  const discover = useCallback(
    async (key: string) => {
      setDiscoveryLoading(true);
      setDiscoveryFailed(false);
      try {
        const list = await service.listModels(provider, key);
        setModels(list);
      } catch {
        setModels([]);
        setDiscoveryFailed(true);
      } finally {
        setDiscoveryLoading(false);
      }
    },
    [provider, service],
  );

  // Mount: load key presence (+ masked suffix), persisted model, and when a
  // key exists run discovery so the picker is populated immediately.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const key = await config.getKey(provider);
      const prefs = await config.getModelId(provider);
      if (cancelled) return;
      if (key) {
        setHasKey(true);
        setStoredKey(key);
        setModel(prefs);
        // Auto-populate the picker; a failure here is not yet "manual mode"
        // (no Test result) — the Test button decides that.
        setDiscoveryLoading(true);
        try {
          const list = await service.listModels(provider, key);
          if (!cancelled) setModels(list);
        } catch {
          if (!cancelled) {
            setModels([]);
            setDiscoveryFailed(true);
          }
        } finally {
          if (!cancelled) setDiscoveryLoading(false);
        }
      } else {
        setModel(prefs);
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [config, provider, service]);

  // Abort any in-flight test when leaving the screen (unmount).
  useEffect(() => () => testAbortRef.current?.abort(), []);

  const effectiveKey = keyText.trim() || storedKey;

  const runTest = async () => {
    if (!effectiveKey) return;
    const controller = new AbortController();
    testAbortRef.current = controller;
    setTesting(true);
    setTestResult(null);
    setTestStopped(false);
    setTestStep({ phase: 'discovering' });
    try {
      const result = await service.testConnection(provider, effectiveKey, {
        signal: controller.signal,
        onStep: setTestStep,
      });
      if (controller.signal.aborted) return; // stopped — no badge, no discovery
      setTestResult(result);
      if (result.ok) await discover(effectiveKey);
    } catch (error: unknown) {
      if (controller.signal.aborted) return; // stop already handled in finally
      setTestResult({ ok: false, reason: 'unknown' });
      Alert.alert('Test Connection', errMsg(error));
    } finally {
      if (controller.signal.aborted) {
        setTestStep(null);
        setTestStopped(true);
      }
      setTesting(false);
      testAbortRef.current = null;
    }
  };

  /** Stop the in-flight test: aborts the request and ignores its outcome. */
  const stopTest = () => {
    testAbortRef.current?.abort();
  };

  const saveKey = async () => {
    const key = keyText.trim();
    if (!key) return;
    setSaving(true);
    try {
      await config.setKey(provider, key);
      setHasKey(true);
      setStoredKey(key);
      setKeyText('');
      setTestResult(null);
      // Populate the picker with the saved key (the Test button re-runs it).
      void discover(key);
    } catch (error: unknown) {
      Alert.alert('Save key', errMsg(error));
    } finally {
      setSaving(false);
    }
  };

  /** Persist the selected model immediately (non-secret settings pref). */
  const selectModel = async (modelId: string) => {
    setModel(modelId);
    try {
      await config.setModelId(provider, modelId);
    } catch (error: unknown) {
      Alert.alert('Select model', errMsg(error));
    }
  };

  const removeKey = () => {
    Alert.alert(
      'Remove key',
      `Remove your ${providerLabel} key? If ${providerLabel} is the active provider, the active choice is cleared too.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemoving(true);
            try {
              await config.removeKey(provider);
              setHasKey(false);
              setStoredKey(null);
              setKeyText('');
              setModels([]);
              setDiscoveryFailed(false);
              setTestResult(null);
              setModel(await config.getModelId(provider));
            } catch (error: unknown) {
              Alert.alert('Remove key', errMsg(error));
            } finally {
              setRemoving(false);
            }
          },
        },
      ],
    );
  };

  if (!ready) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      testID="provider-config-screen"
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{providerLabel}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Bring your own {providerLabel} API key. The key is stored securely on this device and sent
          only to {providerLabel}.
        </Text>
      </View>

      {/* API Key Group */}
      <SettingsGroup title="API key">
        <View style={styles.groupBody}>
          <TextInput
            value={keyText}
            onChangeText={setKeyText}
            placeholder={
              hasKey ? 'Enter a new key to replace the current one' : 'Paste your API key'
            }
            placeholderTextColor={colors.textTertiary}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.input,
              {
                borderColor: colors.separator,
                backgroundColor: colors.fill,
                color: colors.text,
              },
            ]}
            testID="ai-key-input"
          />

          {hasKey && storedKey ? (
            <Text
              numberOfLines={1}
              style={[styles.maskedHint, { color: colors.textSecondary }]}
              testID="ai-key-masked"
            >
              Current key: {maskKeySuffix(storedKey)}
            </Text>
          ) : null}

          <View style={styles.buttonRow}>
            <Pressable
              onPress={() => void saveKey()}
              disabled={!keyText.trim() || saving}
              accessibilityRole="button"
              testID="ai-save-key-button"
              style={({ pressed }) => [
                styles.button,
                styles.buttonFlex,
                {
                  backgroundColor: colors.accent,
                  opacity: !keyText.trim() || saving ? 0.4 : pressed ? 0.8 : 1,
                },
              ]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.onAccent} />
              ) : (
                <Text
                  numberOfLines={1}
                  style={[styles.buttonLabel, { color: colors.onAccent }]}
                >
                  {hasKey ? 'Replace key' : 'Save key'}
                </Text>
              )}
            </Pressable>

            {hasKey ? (
              <Pressable
                onPress={removeKey}
                disabled={removing}
                accessibilityRole="button"
                testID="ai-remove-key-button"
                style={({ pressed }) => [
                  styles.button,
                  {
                    backgroundColor: colors.fillStrong,
                    borderColor: colors.danger,
                    borderWidth: 1,
                    opacity: removing ? 0.4 : pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
                <Text
                  numberOfLines={1}
                  style={[styles.buttonLabel, { color: colors.danger }]}
                >
                  Remove
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </SettingsGroup>

      {/* Connection Group */}
      <SettingsGroup title="Connection">
        <View style={styles.groupBody}>
          <View style={styles.buttonRow}>
            <Pressable
              onPress={() => void runTest()}
              disabled={!effectiveKey || testing}
              accessibilityRole="button"
              testID="ai-test-button"
              style={({ pressed }) => [
                styles.button,
                styles.buttonFlex,
                {
                  backgroundColor: colors.fillStrong,
                  borderColor: colors.separatorStrong,
                  borderWidth: 1,
                  opacity: !effectiveKey || testing ? 0.4 : pressed ? 0.8 : 1,
                },
              ]}
            >
              {testing ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <Ionicons name="sparkles-outline" size={16} color={colors.text} />
              )}
              <Text
                numberOfLines={1}
                style={[styles.buttonLabel, { color: colors.text }]}
              >
                {testing ? 'Testing…' : 'Test Connection'}
              </Text>
            </Pressable>

            {testing ? (
              <Pressable
                onPress={stopTest}
                accessibilityRole="button"
                testID="ai-stop-test-button"
                style={({ pressed }) => [
                  styles.button,
                  {
                    backgroundColor: colors.fillStrong,
                    borderColor: colors.danger,
                    borderWidth: 1,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Ionicons name="stop-circle-outline" size={16} color={colors.danger} />
                <Text
                  numberOfLines={1}
                  style={[styles.buttonLabel, { color: colors.danger }]}
                >
                  Stop
                </Text>
              </Pressable>
            ) : null}
          </View>

          {testing && testStep ? (
            <View style={styles.stepRow} testID="ai-test-step">
              <View style={[styles.stepDot, { backgroundColor: colors.accent }]} />
              <Text
                numberOfLines={1}
                style={[styles.stepText, { color: colors.textSecondary }]}
              >
                {stepLabel(testStep)}
              </Text>
            </View>
          ) : null}

          {testStopped ? (
            <Text
              numberOfLines={1}
              style={[styles.stoppedText, { color: colors.textTertiary }]}
              testID="ai-test-stopped"
            >
              Connection test stopped.
            </Text>
          ) : null}

          {!effectiveKey ? (
            <Text
              numberOfLines={1}
              style={[styles.note, { color: colors.textTertiary }]}
            >
              Enter a key to test the connection.
            </Text>
          ) : null}

          <TestResultBadge result={testResult} providerLabel={providerLabel} />
        </View>
      </SettingsGroup>

      {/* Model Selection Group */}
      <SettingsGroup title="Model">
        <View style={styles.groupBody}>
          {discoveryLoading ? (
            <ActivityIndicator
              style={styles.loading}
              color={colors.accent}
              testID="ai-model-loading"
            />
          ) : (
            <ModelPicker
              models={models}
              selected={model}
              onSelect={selectModel}
              manual={showManual}
              manualValue={manualId}
              onManualChange={setManualId}
            />
          )}
        </View>
      </SettingsGroup>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 48,
    gap: 20,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    gap: 4,
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    fontFamily: geistWeights.bold,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: geistWeights.regular,
  },
  groupBody: {
    padding: 14,
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 46,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    lineHeight: 18,
    fontFamily: geistWeights.regular,
  },
  maskedHint: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: geistWeights.medium,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    minHeight: 44,
    paddingHorizontal: 16,
  },
  buttonFlex: {
    flex: 1,
  },
  buttonLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    fontFamily: geistWeights.semiBold,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stepText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: geistWeights.regular,
  },
  stoppedText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: geistWeights.regular,
  },
  note: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: geistWeights.regular,
  },
  loading: {
    alignSelf: 'center',
    paddingVertical: 16,
  },
});