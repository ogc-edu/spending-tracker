/**
 * Plan 013 — AI Settings UI states (react-test-renderer):
 *   - ProviderRow: Not configured → configured (masked suffix, never the key);
 *   - TestResultBadge: ✓ and every distinct failure reason;
 *   - ModelPicker: discovered list / manual-ID fallback;
 *   - ActiveProviderSelector: "No AI provider configured", configured-only
 *     options + Active tag;
 *   - ProviderConfigScreen: the full not-configured → configured flow, test
 *     result rendering, manual-ID fallback gated on test-ok, model
 *     persistence — against in-memory config + a staged fake service.
 */
import { describe, expect, it } from '@jest/globals';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { AiConfigService } from '@/services/AiConfigService';
import type { TestResult } from '@/ai/types';
import {
  InMemorySecureStore,
  InMemorySettingsRepository,
  makeAuth,
} from '@/services/__tests__/aiTestDoubles';
import { ProviderRow, maskKeySuffix } from '../ProviderRow';
import { TEST_RESULT_LABELS, TestResultBadge } from '../TestResultBadge';
import { ModelPicker } from '../ModelPicker';
import { ActiveProviderSelector } from '../ActiveProviderSelector';
import { ProviderConfigScreen } from '../ProviderConfigScreen';

/** Flatten every Text child under the element with the given testID. */
function textOf(root: ReactTestInstance, testID: string): string {
  const el = byTestID(root, testID);
  const texts: string[] = [];
  const collect = (node: ReactTestInstance): void => {
    for (const child of node.children) {
      if (typeof child === 'string') texts.push(child);
      else collect(child);
    }
  };
  collect(el);
  return texts.join('');
}

/**
 * testID props are duplicated across composite + host nodes (Pressable
 * forwards props down); find ALL matches and take the last (deepest host).
 */
function byTestID(root: ReactTestInstance, testID: string): ReactTestInstance {
  const matches = root.findAllByProps({ testID });
  const el = matches[matches.length - 1];
  if (!el) throw new Error(`no element with testID ${testID}`);
  return el;
}

function hasTestID(root: ReactTestInstance, testID: string): boolean {
  return root.findAllByProps({ testID }).length > 0;
}

async function render(element: React.ReactElement): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(element);
  });
  await act(async () => {}); // flush any promise continuations from effects
  return tree;
}

function press(tree: ReactTestRenderer, testID: string): Promise<void> {
  const matches = tree.root.findAllByProps({ testID });
  const el =
    matches.find((m) => typeof (m.props as { onPress?: unknown }).onPress === 'function') ??
    matches[matches.length - 1]!;
  return act(async () => {
    (el.props as { onPress: () => void }).onPress();
  });
}

function changeText(tree: ReactTestRenderer, testID: string, text: string): Promise<void> {
  const matches = tree.root.findAllByProps({ testID });
  const el =
    matches.find((m) => typeof (m.props as { onChangeText?: unknown }).onChangeText === 'function') ??
    matches[matches.length - 1]!;
  return act(async () => {
    (el.props as { onChangeText: (t: string) => void }).onChangeText(text);
  });
}

/** Result-bearing elements (ok badge or any failure-reason badge). */
function resultBadges(tree: ReactTestInstance): ReactTestInstance[] {
  return tree.findAll(
    (n) => typeof n.props.testID === 'string' && n.props.testID.startsWith('ai-test-result'),
  );
}

const RAW_KEY = 'AQ-test-1234WXYZ';

function makeConfig() {
  const store = new InMemorySecureStore();
  const repo = new InMemorySettingsRepository();
  return { store, repo, config: new AiConfigService(repo, makeAuth(1), store) };
}

describe('maskKeySuffix', () => {
  it('masks to 12 bullets + the last 4 chars (fixed mask, per the spec example)', () => {
    expect(maskKeySuffix('AQ-test-1234WXYZ')).toBe('••••••••••••WXYZ');
    // Keys shorter than the visible window are fully bulleted.
    expect(maskKeySuffix('abcde')).toBe('••••••••••••bcde');
  });
});

describe('ProviderRow', () => {
  it('shows Not configured when no key is stored', async () => {
    const tree = await render(<ProviderRow provider="gemini" configured={false} suffix={null} onPress={() => {}} />);
    expect(textOf(tree.root, 'ai-provider-status-gemini')).toBe('Not configured');
  });

  it('shows the masked suffix when configured — never the raw key', async () => {
    const tree = await render(
      <ProviderRow provider="deepseek" configured suffix={maskKeySuffix(RAW_KEY)} onPress={() => {}} />,
    );
    const rendered = JSON.stringify(tree.toJSON());
    expect(textOf(tree.root, 'ai-provider-status-deepseek')).toBe('••••••••••••WXYZ');
    expect(rendered).not.toContain(RAW_KEY);
  });

  it('fires onPress when tapped', async () => {
    let pressed = false;
    const tree = await render(
      <ProviderRow provider="gemini" configured={false} suffix={null} onPress={() => { pressed = true; }} />,
    );
    await press(tree, 'ai-provider-row-gemini');
    expect(pressed).toBe(true);
  });
});

describe('TestResultBadge', () => {
  it('renders nothing before a result exists', async () => {
    const tree = await render(<TestResultBadge result={null} providerLabel="Gemini" />);
    expect(resultBadges(tree.root)).toHaveLength(0);
  });

  it('renders ✓ with the provider label on success', async () => {
    const tree = await render(<TestResultBadge result={{ ok: true }} providerLabel="Gemini" />);
    expect(textOf(tree.root, 'ai-test-result-ok')).toBe('✓ Gemini connection successful');
  });

  it('renders a distinct, user-addressable label per failure reason', async () => {
    for (const reason of ['invalidKey', 'quota', 'modelUnavailable', 'network', 'unknown'] as const) {
      const tree = await render(
        <TestResultBadge result={{ ok: false, reason }} providerLabel="DeepSeek" />,
      );
      expect(textOf(tree.root, `ai-test-result-${reason}`)).toContain(TEST_RESULT_LABELS[reason]);
    }
  });
});

describe('ModelPicker', () => {
  it('lists discovered models with the persisted selection highlighted', async () => {
    const picked: string[] = [];
    const tree = await render(
      <ModelPicker
        models={[
          { id: 'gemini-3.6-flash' },
          { id: 'gemini-2.5-pro' },
        ]}
        selected="gemini-3.6-flash"
        onSelect={(id) => picked.push(id)}
        manual={false}
        manualValue=""
        onManualChange={() => {}}
      />,
    );
    expect(hasTestID(tree.root, 'ai-model-option-gemini-3.6-flash')).toBe(true);
    expect(textOf(tree.root, 'ai-model-option-gemini-3.6-flash')).toContain('Selected');
    await press(tree, 'ai-model-option-gemini-2.5-pro');
    expect(picked).toEqual(['gemini-2.5-pro']);
  });

  it('shows the manual-ID field with a guarded Use button when discovery failed', async () => {
    const picked: string[] = [];
    const tree = await render(
      <ModelPicker
        models={[]}
        selected={null}
        onSelect={(id) => picked.push(id)}
        manual
        manualValue="gemini-3.6-flash"
        onManualChange={() => {}}
      />,
    );
    expect(textOf(tree.root, 'ai-model-manual')).toContain('Discovery failed');
    await press(tree, 'ai-model-manual-use');
    expect(picked).toEqual(['gemini-3.6-flash']);
  });

  it('hints to test first when there is nothing to pick', async () => {
    const tree = await render(
      <ModelPicker models={[]} selected={null} onSelect={() => {}} manual={false} manualValue="" onManualChange={() => {}} />,
    );
    expect(textOf(tree.root, 'ai-model-empty')).toContain('Test the connection');
  });
});

describe('ActiveProviderSelector', () => {
  it('shows "No AI provider configured" when nothing is configured', async () => {
    const tree = await render(
      <ActiveProviderSelector configured={[]} active={null} onSelect={() => {}} />,
    );
    expect(textOf(tree.root, 'ai-active-selector-empty')).toContain('No AI provider configured');
  });

  it('lists ONLY configured providers and tags the active one', async () => {
    const picked: string[] = [];
    const tree = await render(
      <ActiveProviderSelector configured={['deepseek']} active="deepseek" onSelect={(p) => picked.push(p)} />,
    );
    expect(hasTestID(tree.root, 'ai-active-option-gemini')).toBe(false);
    expect(hasTestID(tree.root, 'ai-active-option-deepseek')).toBe(true);
    expect(hasTestID(tree.root, 'ai-active-tag-deepseek')).toBe(true);
    await press(tree, 'ai-active-option-deepseek');
    expect(picked).toEqual(['deepseek']);
  });
});

describe('ProviderConfigScreen — state flows', () => {
  const okService = (discoverFail = false) => {
    const calls: { kind: 'test' | 'list'; key: string }[] = [];
    return {
      calls,
      service: {
        testConnection: async (provider: string, key: string): Promise<TestResult> => {
          calls.push({ kind: 'test', key });
          return { ok: true };
        },
        listModels: async (provider: string, key: string) => {
          calls.push({ kind: 'list', key });
          if (discoverFail) throw new Error('discovery failed');
          return [{ id: 'gemini-3.6-flash' }, { id: 'gemini-2.5-pro' }];
        },
      },
    };
  };

  it('goes not-configured → configured: save key persists, masked hint shown, key never rendered raw', async () => {
    const { store, config } = makeConfig();
    const { service } = okService();
    const tree = await render(<ProviderConfigScreen provider="gemini" config={config} service={service} />);

    // Save is disabled until a key is typed.
    await press(tree, 'ai-save-key-button');
    expect(await config.getKey('gemini')).toBeNull();

    await changeText(tree, 'ai-key-input', RAW_KEY);
    await press(tree, 'ai-save-key-button');

    expect(await config.getKey('gemini')).toBe(RAW_KEY);
    expect(textOf(tree.root, 'ai-key-masked')).toBe(`Current key: ${maskKeySuffix(RAW_KEY)}`);
    const rendered = JSON.stringify(tree.toJSON());
    expect(rendered).not.toContain(RAW_KEY);
    expect(rendered).toContain(maskKeySuffix(RAW_KEY));
    expect(store.map.get('key_gemini_1')).toBe(RAW_KEY);
  });

  it('saving also populates the model picker (discovery on the saved key)', async () => {
    const { config } = makeConfig();
    const { calls, service } = okService();
    const tree = await render(<ProviderConfigScreen provider="gemini" config={config} service={service} />);

    await changeText(tree, 'ai-key-input', RAW_KEY);
    await press(tree, 'ai-save-key-button');
    await act(async () => {});

    expect(calls.some((c) => c.kind === 'list' && c.key === RAW_KEY)).toBe(true);
    expect(hasTestID(tree.root, 'ai-model-option-gemini-3.6-flash')).toBe(true);
  });

  it('maps the test outcome to a distinct badge and refreshes the model list', async () => {
    const { config } = makeConfig();
    let testResult: TestResult = { ok: false, reason: 'quota' };
    let listCalled = false;
    const tree = await render(
      <ProviderConfigScreen
        provider="gemini"
        config={config}
        service={{
          testConnection: async () => testResult,
          listModels: async () => {
            listCalled = true;
            return [{ id: 'gemini-3.6-flash' }];
          },
        }}
      />,
    );

    await changeText(tree, 'ai-key-input', RAW_KEY);
    await press(tree, 'ai-test-button');
    expect(hasTestID(tree.root, 'ai-test-result-quota')).toBe(true);
    expect(listCalled).toBe(false); // discovery only follows a SUCCESSFUL test

    testResult = { ok: true };
    await press(tree, 'ai-test-button');
    expect(hasTestID(tree.root, 'ai-test-result-ok')).toBe(true);
    expect(listCalled).toBe(true);
  });

  it('shows the manual model-ID field only when the key tested OK but discovery failed', async () => {
    const { config } = makeConfig();
    const { service } = okService(true);
    const tree = await render(<ProviderConfigScreen provider="gemini" config={config} service={service} />);

    // Mount with no key → nothing to test/discover; no manual field.
    expect(hasTestID(tree.root, 'ai-model-manual')).toBe(false);

    await changeText(tree, 'ai-key-input', RAW_KEY);
    await press(tree, 'ai-test-button');
    await act(async () => {});

    // Test OK + discovery failed → manual-ID entry appears and persists on Use.
    expect(hasTestID(tree.root, 'ai-test-result-ok')).toBe(true);
    expect(textOf(tree.root, 'ai-model-manual')).toContain('enter the model ID manually');

    await changeText(tree, 'ai-model-manual-input', 'gemini-x-1');
    await press(tree, 'ai-model-manual-use');
    expect(await config.getModelId('gemini')).toBe('gemini-x-1');
  });

  it('persists a picked discovered model immediately', async () => {
    const { config } = makeConfig();
    await config.setKey('gemini', RAW_KEY); // configured before opening the screen
    const { service } = okService();
    const tree = await render(<ProviderConfigScreen provider="gemini" config={config} service={service} />);

    expect(hasTestID(tree.root, 'ai-model-option-gemini-3.6-flash')).toBe(true);
    await press(tree, 'ai-model-option-gemini-2.5-pro');
    expect(await config.getModelId('gemini')).toBe('gemini-2.5-pro');
  });
});