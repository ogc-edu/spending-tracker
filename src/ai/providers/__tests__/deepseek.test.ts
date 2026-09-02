/**
 * Plan 013 — DeepSeekProvider against a mocked fetch (BYOK, no network).
 * Asserts: Authorization: Bearer auth, discovery dropping *-vision-* ids,
 * chat/completions body fixtures (max_tokens: 1 test; json_object generate),
 * the 400/422 → retry-without-response_format prompt-embedded fallback, and
 * the status → TestResult / AIErrorReason mappings.
 */
import { describe, expect, it } from '@jest/globals';
import { createDeepseekProvider } from '../deepseek';
import { AIUnavailableError } from '../../errors';
import type { AIAnalyzeRequest } from '../../types';
import { bodyOf, mockFetch, type MockCall } from './mockFetch';

const DEEPSEEK_BASE = 'https://api.deepseek.com';

const MODELS_BODY = {
  object: 'list',
  data: [
    { id: 'deepseek-v4-flash' },
    { id: 'deepseek-v4-pro' },
    { id: 'deepseek-v4-flash-vision-exp' },
    { id: 'deepseek-v4-reasoner' },
  ],
};

const KEY = 'sk-ds-test-key';
/** The Authorization header value the provider must send (never a bare key). */
const BEARER = `Bearer ${KEY}`;

function analyzeRequest(overrides: Partial<AIAnalyzeRequest> = {}): AIAnalyzeRequest {
  return {
    context: 'spending',
    systemPrompt: 'Output JSON in exactly this shape: {"summary": string, "points": string[]}.',
    snapshot: '{"month":"2026-08","totalSen":300000}',
    key: KEY,
    modelId: 'deepseek-v4-flash',
    ...overrides,
  };
}

describe('DeepSeekProvider.listModels (AI-8 — discovery only, nothing hardcoded)', () => {
  it('GETs /models with a Bearer token and drops vision models', async () => {
    const { fetchImpl, calls } = mockFetch({ json: MODELS_BODY });
    const provider = createDeepseekProvider(fetchImpl);

    const models = await provider.listModels(KEY);

    expect(calls[0]?.url).toBe(`${DEEPSEEK_BASE}/models`);
    expect(calls[0]?.init?.headers).toEqual({ authorization: BEARER });
    expect(models).toEqual([
      { id: 'deepseek-v4-flash' },
      { id: 'deepseek-v4-pro' },
      { id: 'deepseek-v4-reasoner' },
    ]);
  });

  it('throws a typed invalidKey error on 401 and invalidResponse on a bad shape', async () => {
    const { fetchImpl } = mockFetch({ status: 401, text: 'Authentication Fails' });
    const provider = createDeepseekProvider(fetchImpl);
    await expect(provider.listModels(KEY)).rejects.toMatchObject({ reason: 'invalidKey' });

    const { fetchImpl: bad } = mockFetch({ json: { notData: [] } });
    await expect(createDeepseekProvider(bad).listModels(KEY)).rejects.toMatchObject({
      reason: 'invalidResponse',
    });
  });
});

describe('DeepSeekProvider.testConnection (AI-7 — minimal real request)', () => {
  it('sends a max_tokens: 1 chat/completions on the FIRST suitable model', async () => {
    const { fetchImpl, calls } = mockFetch(
      { json: MODELS_BODY },
      { json: { choices: [{ message: { content: 'pong' } }] } },
    );
    const provider = createDeepseekProvider(fetchImpl);

    await expect(provider.testConnection(KEY)).resolves.toEqual({ ok: true });

    expect(calls[1]?.url).toBe(`${DEEPSEEK_BASE}/chat/completions`);
    expect(calls[1]?.init?.headers).toEqual({
      authorization: BEARER,
      'content-type': 'application/json',
    });
    const body = bodyOf(calls[1]!) as { model: string; messages: { role: string; content: string }[]; max_tokens: number };
    expect(body.model).toBe('deepseek-v4-flash');
    expect(body.messages).toEqual([{ role: 'user', content: 'ping' }]);
    expect(body.max_tokens).toBe(1);
  });

  it('maps 401 → invalidKey / 429 → quota / 404 → modelUnavailable / network → network', async () => {
    for (const [step, reason] of [
      [{ status: 401, json: { error: {} } }, 'invalidKey'],
      [{ status: 403, json: { error: {} } }, 'invalidKey'],
      [{ status: 429, json: { error: {} } }, 'quota'],
      [{ status: 404, json: { error: {} } }, 'modelUnavailable'],
      [new TypeError('socket hang up'), 'network'],
    ] as const) {
      const { fetchImpl } = mockFetch({ json: MODELS_BODY }, step);
      const provider = createDeepseekProvider(fetchImpl);
      await expect(provider.testConnection(KEY)).resolves.toEqual({ ok: false, reason });
    }
  });

  it('returns modelUnavailable when every discovered model is a vision model', async () => {
    const { fetchImpl } = mockFetch({
      json: { data: [{ id: 'deepseek-v4-flash-vision-exp' }] },
    });
    const provider = createDeepseekProvider(fetchImpl);
    await expect(provider.testConnection(KEY)).resolves.toEqual({
      ok: false,
      reason: 'modelUnavailable',
    });
  });
});

describe('DeepSeekProvider.analyze', () => {
  it('sends json_object response_format and returns the raw JSON text', async () => {
    const raw = '{"summary":"Food is up","points":["+120 sen/day"]}';
    const { fetchImpl, calls } = mockFetch({
      json: { choices: [{ message: { content: raw } }] },
    });
    const provider = createDeepseekProvider(fetchImpl);

    await expect(provider.analyze(analyzeRequest())).resolves.toBe(raw);

    const body = bodyOf(calls[0]!) as {
      model: string;
      messages: { role: string; content: string }[];
      response_format: { type: string };
      stream: boolean;
    };
    expect(body.model).toBe('deepseek-v4-flash');
    expect(body.messages[0]).toEqual({ role: 'system', content: analyzeRequest().systemPrompt });
    expect(body.messages[1]?.content).toContain('{"month":"2026-08"');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.stream).toBe(false);
  });

  it('retries WITHOUT response_format on 400 and tolerantly extracts the JSON block', async () => {
    const fenced = '```json\n{"summary":"Fallback","points":["extracted"]}\n```';
    const { fetchImpl, calls } = mockFetch(
      { status: 400, json: { error: { message: 'response_format unsupported' } } },
      { json: { choices: [{ message: { content: fenced } }] } },
    );
    const provider = createDeepseekProvider(fetchImpl);

    await expect(provider.analyze(analyzeRequest())).resolves.toBe(
      '{"summary":"Fallback","points":["extracted"]}',
    );

    expect(calls).toHaveLength(2);
    const retry = bodyOf(calls[1]!) as {
      response_format?: unknown;
      messages: { role: string; content: string }[];
    };
    expect(retry.response_format).toBeUndefined();
    // The retry appends the explicit raw-JSON instruction to the conversation.
    expect(retry.messages[2]?.content).toContain('{"summary": string, "points": string[5]}');
  });

  it('extracts the first {...} block from prose-wrapped output', async () => {
    const prose = 'Here is your analysis:\n{"summary":"OK","points":[]}\nHope that helps.';
    const { fetchImpl } = mockFetch({ json: { choices: [{ message: { content: prose } }] } });
    const provider = createDeepseekProvider(fetchImpl);
    await expect(provider.analyze(analyzeRequest())).resolves.toBe('{"summary":"OK","points":[]}');
  });

  it('does not retry (nor mask) a 401 on the response_format attempt', async () => {
    const { fetchImpl, calls } = mockFetch({ status: 401, json: { error: {} } });
    const provider = createDeepseekProvider(fetchImpl);
    await expect(provider.analyze(analyzeRequest())).rejects.toMatchObject({
      reason: 'invalidKey',
    });
    expect(calls).toHaveLength(1);
  });

  it('throws invalidResponse for empty or unusable content', async () => {
    const { fetchImpl } = mockFetch({ json: { choices: [{ message: { content: '' } }] } });
    const provider = createDeepseekProvider(fetchImpl);
    await expect(provider.analyze(analyzeRequest())).rejects.toMatchObject({
      reason: 'invalidResponse',
    });

    const { fetchImpl: noChoice } = mockFetch({ json: { choices: [] } });
    await expect(createDeepseekProvider(noChoice).analyze(analyzeRequest())).rejects.toMatchObject({
      reason: 'invalidResponse',
    });
  });

  it('throws modelUnavailable without a selected model (never reaches the network)', async () => {
    const { fetchImpl, calls } = mockFetch({ json: { choices: [] } });
    const provider = createDeepseekProvider(fetchImpl);
    await expect(
      provider.analyze(analyzeRequest({ modelId: undefined })),
    ).rejects.toBeInstanceOf(AIUnavailableError);
    await expect(
      provider.analyze(analyzeRequest({ modelId: undefined })),
    ).rejects.toMatchObject({ reason: 'modelUnavailable' });
    expect(calls).toHaveLength(0);
  });

  it('records its calls so key never appears in requests other than Authorization', async () => {
    const raw = '{"summary":"x","points":[]}';
    const { fetchImpl, calls } = mockFetch({ json: { choices: [{ message: { content: raw } }] } });
    const provider = createDeepseekProvider(fetchImpl);
    await provider.analyze(analyzeRequest());
    const joined = calls.map((c: MockCall) => `${c.url}${JSON.stringify(c.init)}`).join('\n');
    // The key appears ONLY inside the Authorization header — nowhere else.
    expect(joined.match(/sk-ds-test-key/g)).toHaveLength(1);
    expect(joined).toContain(`Bearer ${KEY}`);
  });
});