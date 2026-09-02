/**
 * Plan 013 — ProviderConfigScreen: per-provider BYOK configuration (PRD AI-6..10).
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
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AIService } from '@/ai/AIService';
import type { ModelInfo, TestResult } from '@/ai/types';
import type { AiConfigService, ConfigurableAIProvider } from '@/services/AiConfigService';
import { colors, spacing, typography } from '@/theme';
import { maskKeySuffix } from './ProviderRow';
import { PROVIDER_LABELS } from './providerMeta';
import { ModelPicker } from './ModelPicker';
import { TestResultBadge } from './TestResultBadge';

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
  const [keyText, setKeyText] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [storedKey, setStoredKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
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

  const effectiveKey = keyText.trim() || storedKey;

  const runTest = async () => {
    if (!effectiveKey) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await service.testConnection(provider, effectiveKey);
      setTestResult(result);
      if (result.ok) await discover(effectiveKey);
    } catch (error: unknown) {
      setTestResult({ ok: false, reason: 'unknown' });
      Alert.alert('Test Connection', errMsg(error));
    } finally {
      setTesting(false);
    }
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
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      testID="provider-config-screen"
    >
      <Text style={styles.title}>{providerLabel}</Text>
      <Text style={styles.subtitle}>
        Bring your own {providerLabel} API key. The key is stored securely on this device and sent
        only to {providerLabel}.
      </Text>

      {/* Key section */}
      <Text style={styles.sectionTitle}>API key</Text>
      <TextInput
        value={keyText}
        onChangeText={setKeyText}
        placeholder={hasKey ? 'Enter a new key to replace the current one' : 'Paste your API key'}
        placeholderTextColor={colors.muted}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
        testID="ai-key-input"
      />
      {hasKey && storedKey ? (
        <Text style={styles.maskedHint} testID="ai-key-masked">
          Current key: {maskKeySuffix(storedKey)}
        </Text>
      ) : null}
      <View style={styles.buttonRow}>
        <Pressable
          onPress={saveKey}
          disabled={!keyText.trim() || saving}
          style={({ pressed }) => [styles.button, styles.buttonPrimary, (!keyText.trim() || saving) && styles.buttonDisabled, pressed && styles.pressed]}
          accessibilityRole="button"
          testID="ai-save-key-button"
        >
          <Text style={styles.buttonPrimaryLabel}>{hasKey ? 'Replace key' : 'Save key'}</Text>
        </Pressable>
        {hasKey ? (
          <Pressable
            onPress={removeKey}
            disabled={removing}
            style={({ pressed }) => [styles.button, styles.buttonDanger, pressed && styles.pressed]}
            accessibilityRole="button"
            testID="ai-remove-key-button"
          >
            <Ionicons name="trash-outline" size={16} color="#fff" />
            <Text style={styles.buttonDangerLabel}>Remove</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Test Connection */}
      <Text style={styles.sectionTitle}>Connection</Text>
      <Pressable
        onPress={runTest}
        disabled={!effectiveKey || testing}
        style={({ pressed }) => [styles.button, styles.buttonOutline, (!effectiveKey || testing) && styles.buttonDisabled, pressed && styles.pressed]}
        accessibilityRole="button"
        testID="ai-test-button"
      >
        {testing ? <ActivityIndicator size="small" color={colors.accent} /> : null}
        <Text style={styles.buttonOutlineLabel}>
          {testing ? 'Testing…' : 'Test Connection'}
        </Text>
      </Pressable>
      {!effectiveKey ? (
        <Text style={styles.note}>Enter a key to test the connection.</Text>
      ) : null}
      <TestResultBadge result={testResult} providerLabel={providerLabel} />

      {/* Model selection */}
      <Text style={styles.sectionTitle}>Model</Text>
      {discoveryLoading ? (
        <ActivityIndicator style={styles.loading} testID="ai-model-loading" />
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: typography.title, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  subtitle: { fontSize: typography.caption, color: colors.muted, marginBottom: spacing.xl },
  sectionTitle: {
    fontSize: typography.emphasis,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.body,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  maskedHint: { fontSize: typography.caption, color: colors.muted, marginBottom: spacing.sm },
  buttonRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  buttonPrimary: { backgroundColor: colors.accent, flex: 1 },
  buttonPrimaryLabel: { color: '#fff', fontSize: typography.emphasis, fontWeight: '600' },
  buttonDanger: { backgroundColor: colors.danger, paddingHorizontal: spacing.md },
  buttonDangerLabel: { color: '#fff', fontSize: typography.emphasis, fontWeight: '600' },
  buttonOutline: {
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  buttonOutlineLabel: { color: colors.accent, fontSize: typography.emphasis, fontWeight: '600' },
  buttonDisabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  note: { fontSize: typography.caption, color: colors.muted, marginBottom: spacing.sm },
  loading: { alignSelf: 'flex-start', marginBottom: spacing.md },
});