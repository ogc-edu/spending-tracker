/**
 * Plan 013 — GeminiProvider against a mocked fetch (BYOK, no network).
 * Asserts: x-goog-api-key auth (never OAuth), discovery filtering to text
 * generation, 1-token test on the FIRST suitable model, JSON-mode generate,
 * and the status → TestResult / AIErrorReason mappings.
 */
import { describe, expect, it } from '@jest/globals';
import { createGeminiProvider } from '../gemini';
import { AIUnavailableError } from '../../errors';
import type { AIAnalyzeRequest, TestStep } from '../../types';
import { RequestCancelledError, type FetchLike } from '../http';
import { bodyOf, mockFetch } from './mockFetch';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const DISCOVERY_BODY = {
  models: [
    { name: 'models/gemini-3.6-flash', supportedGenerationMethods: ['generateContent', 'embedContent'] },
    { name: 'models/gemini-flash-latest', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-embedding-001', supportedGenerationMethods: ['embedContent'] },
    { name: 'models/imagen-3.0-generate-001', supportedGenerationMethods: ['imageGeneration'] },
    { name: 'models/video-gemini-preview', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/tts-1', supportedGenerationMethods: ['generate'] },
    { name: 'models/audio-gemini', supportedGenerationMethods: ['generateContent'] },
    // 2026-09 catalog families that list generateContent but are NOT text
    // models for financial analysis — the filter must drop them:
    { name: 'models/antigravity-preview-05-2026', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/deep-research-preview-04-2026', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/lyria-3-clip-preview', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/nano-banana-pro-preview', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-2.5-computer-use-preview-10-2025', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-3.5-transcribe', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-robotics-er-2-preview', supportedGenerationMethods: ['generateContent'] },
  ],
};

const KEY = 'AQ-test-key-1234';

function analyzeRequest(overrides: Partial<AIAnalyzeRequest> = {}): AIAnalyzeRequest {
  return {
    context: 'debt',
    systemPrompt: 'Output JSON in exactly this shape: {"summary": string, "points": string[]}.',
    snapshot: '{"commitments":[],"totalRemainingSen":0}',
    key: KEY,
    modelId: 'gemini-3.6-flash',
    ...overrides,
  };
}

describe('GeminiProvider.listModels (AI-8 — discovery only, nothing hardcoded)', () => {
  it('GETs /models with x-goog-api-key and returns text-generation models sorted', async () => {
    const { fetchImpl, calls } = mockFetch({ json: DISCOVERY_BODY });
    const provider = createGeminiProvider(fetchImpl);

    const models = await provider.listModels(KEY);

    expect(calls[0]?.url).toBe(`${GEMINI_BASE}/models`);
    expect(calls[0]?.init?.headers).toEqual({ 'x-goog-api-key': KEY });
    // embedding/image/video/tts/audio excluded; generateContent-only kept, sorted.
    expect(models).toEqual([
      { id: 'gemini-2.5-pro', label: 'gemini-2.5-pro' },
      { id: 'gemini-3.6-flash', label: 'gemini-3.6-flash' },
      { id: 'gemini-flash-latest', label: 'gemini-flash-latest' },
    ]);
  });

  it('throws a typed invalidKey error on 401', async () => {
    const { fetchImpl } = mockFetch({ status: 401, json: { error: {} } });
    const provider = createGeminiProvider(fetchImpl);
    await expect(provider.listModels(KEY)).rejects.toMatchObject({ reason: 'invalidKey' });
  });

  it('throws invalidResponse when the listing shape is wrong', async () => {
    const { fetchImpl } = mockFetch({ json: { notModels: [] } });
    const provider = createGeminiProvider(fetchImpl);
    await expect(provider.listModels(KEY)).rejects.toMatchObject({ reason: 'invalidResponse' });
  });
});

describe('GeminiProvider.testConnection (AI-7 — minimal real request)', () => {
  it('tests the FIRST suitable model with a 1-token generateContent', async () => {
    const { fetchImpl, calls } = mockFetch(
      { json: DISCOVERY_BODY },
      { json: { candidates: [{ content: { parts: [{ text: 'ok' }] } }] } },
    );
    const provider = createGeminiProvider(fetchImpl);

    await expect(provider.testConnection(KEY)).resolves.toEqual({ ok: true });

    expect(calls[1]?.url).toBe(`${GEMINI_BASE}/models/gemini-2.5-pro:generateContent`);
    const body = bodyOf(calls[1]!) as { contents: unknown; generationConfig: { maxOutputTokens: number } };
    expect(body.contents).toEqual([{ parts: [{ text: 'ok' }] }]);
    expect(body.generationConfig.maxOutputTokens).toBe(1);
  });

  it('maps 401 → invalidKey / 429 → quota / 404 → modelUnavailable', async () => {
    for (const [status, reason] of [
      [401, 'invalidKey'],
      [403, 'invalidKey'],
      [429, 'quota'],
      [404, 'modelUnavailable'],
    ] as const) {
      const { fetchImpl } = mockFetch(
        { json: DISCOVERY_BODY },
        { status, json: { error: {} } },
      );
      const provider = createGeminiProvider(fetchImpl);
      await expect(provider.testConnection(KEY)).resolves.toEqual({ ok: false, reason });
    }
  });

  it('maps a transport failure → network', async () => {
    const { fetchImpl } = mockFetch(
      { json: DISCOVERY_BODY },
      new TypeError('Network request failed'),
    );
    const provider = createGeminiProvider(fetchImpl);
    await expect(provider.testConnection(KEY)).resolves.toEqual({ ok: false, reason: 'network' });
  });

  it('returns modelUnavailable when discovery filters everything out', async () => {
    const { fetchImpl } = mockFetch({ json: { models: [{ name: 'models/imagen-9', supportedGenerationMethods: ['imageGeneration'] }] } });
    const provider = createGeminiProvider(fetchImpl);
    await expect(provider.testConnection(KEY)).resolves.toEqual({
      ok: false,
      reason: 'modelUnavailable',
    });
  });

  it('skips a model that rejects generateContent (400, Interactions-API-only) and tests the next', async () => {
    const { fetchImpl, calls } = mockFetch(
      { json: DISCOVERY_BODY },
      { status: 400, json: { error: { message: 'This model only supports Interactions API.' } } },
      { json: { candidates: [{ content: { parts: [{ text: 'ok' }] } }] } },
    );
    const provider = createGeminiProvider(fetchImpl);

    await expect(provider.testConnection(KEY)).resolves.toEqual({ ok: true });

    // discovery + gemini-2.5-pro (400) + gemini-3.6-flash (ok) — no further calls.
    expect(calls).toHaveLength(3);
    expect(calls[2]?.url).toContain('gemini-3.6-flash:generateContent');
  });

  it('skips a retired model (404) and succeeds on the next', async () => {
    const { fetchImpl, calls } = mockFetch(
      { json: DISCOVERY_BODY },
      { status: 404, json: { error: { message: 'no longer available to new users' } } },
      { json: { candidates: [] } },
    );
    const provider = createGeminiProvider(fetchImpl);

    await expect(provider.testConnection(KEY)).resolves.toEqual({ ok: true });
    expect(calls).toHaveLength(3);
    expect(calls[2]?.url).toContain('gemini-3.6-flash:generateContent');
  });

  it('returns modelUnavailable when EVERY discovered model rejects the call', async () => {
    const { fetchImpl, calls } = mockFetch(
      { json: DISCOVERY_BODY },
      { status: 404, json: { error: {} } },
    );
    const provider = createGeminiProvider(fetchImpl);

    await expect(provider.testConnection(KEY)).resolves.toEqual({
      ok: false,
      reason: 'modelUnavailable',
    });
    // discovery + one generate per suitable model, never more.
    expect(calls).toHaveLength(4);
  });

  it('stops immediately on an auth failure — later models are NOT tried', async () => {
    const { fetchImpl, calls } = mockFetch(
      { json: DISCOVERY_BODY },
      { status: 401, json: { error: {} } },
    );
    const provider = createGeminiProvider(fetchImpl);

    await expect(provider.testConnection(KEY)).resolves.toEqual({
      ok: false,
      reason: 'invalidKey',
    });
    expect(calls).toHaveLength(2); // discovery + ONE generate attempt
  });

  it('reports live progress: discovering → testing → unavailable-skip → testing → ok', async () => {
    const { fetchImpl } = mockFetch(
      { json: DISCOVERY_BODY },
      { status: 404, json: { error: {} } },
      { json: { candidates: [] } },
    );
    const steps: TestStep[] = [];
    const provider = createGeminiProvider(fetchImpl);

    await expect(
      provider.testConnection(KEY, { onStep: (step) => steps.push(step) }),
    ).resolves.toEqual({ ok: true });

    expect(steps).toEqual([
      { phase: 'discovering' },
      { phase: 'testing', modelId: 'gemini-2.5-pro' },
      { phase: 'unavailable', modelId: 'gemini-2.5-pro' },
      { phase: 'testing', modelId: 'gemini-3.6-flash' },
    ]);
  });

  it('aborting the signal rejects with RequestCancelledError and stops the loop', async () => {
    const controller = new AbortController();
    const urls: string[] = [];
    const fetchImpl: FetchLike = async (url, init) => {
      urls.push(url);
      if (url.includes('/models') && !url.includes(':generateContent')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify(DISCOVERY_BODY),
        } as unknown as Response;
      }
      // Model generate calls hang until OUR signal aborts them.
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
      });
    };
    const provider = createGeminiProvider(fetchImpl);

    const pending = provider
      .testConnection(KEY, { signal: controller.signal })
      .catch((err) => err);
    await new Promise((r) => setTimeout(r, 0));
    controller.abort();
    const err = await pending;

    expect(err).toBeInstanceOf(RequestCancelledError);
    expect(urls).toHaveLength(2); // discovery + ONLY the first model attempt
  });
});

describe('GeminiProvider.analyze', () => {
  it('sends JSON-mode generateContent and returns the raw JSON text', async () => {
    const raw = '{"summary":"Rent is due.","points":["Pay by the 1st"]}';
    const { fetchImpl, calls } = mockFetch({
      json: { candidates: [{ content: { parts: [{ text: raw }] } }] },
    });
    const provider = createGeminiProvider(fetchImpl);

    await expect(provider.analyze(analyzeRequest())).resolves.toBe(raw);

    expect(calls[0]?.url).toBe(`${GEMINI_BASE}/models/gemini-3.6-flash:generateContent`);
    expect(calls[0]?.init?.headers).toEqual({
      'x-goog-api-key': KEY,
      'content-type': 'application/json',
    });
    const body = bodyOf(calls[0]!) as {
      contents: { parts: { text: string }[] }[];
      systemInstruction: { parts: { text: string }[] };
      generationConfig: { responseMimeType: string };
    };
    expect(body.contents[0]?.parts[0]?.text).toContain('{"commitments":[]');
    expect(body.systemInstruction.parts[0]?.text).toBe(analyzeRequest().systemPrompt);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
  });

  it('joins multi-part candidate text', async () => {
    const { fetchImpl } = mockFetch({
      json: { candidates: [{ content: { parts: [{ text: '{"sum' }, { text: 'mary":"x","points":[]}' }] } }] },
    });
    const provider = createGeminiProvider(fetchImpl);
    await expect(provider.analyze(analyzeRequest())).resolves.toBe('{"summary":"x","points":[]}');
  });

  it('throws invalidResponse when the model returns no text', async () => {
    const { fetchImpl } = mockFetch({ json: { candidates: [{ content: { parts: [] } }] } });
    const provider = createGeminiProvider(fetchImpl);
    await expect(provider.analyze(analyzeRequest())).rejects.toMatchObject({
      reason: 'invalidResponse',
    });
  });

  it('throws modelUnavailable without a selected model', async () => {
    const { fetchImpl } = mockFetch({ json: { candidates: [] } });
    const provider = createGeminiProvider(fetchImpl);
    await expect(
      provider.analyze(analyzeRequest({ modelId: undefined })),
    ).rejects.toBeInstanceOf(AIUnavailableError);
    await expect(
      provider.analyze(analyzeRequest({ modelId: undefined })),
    ).rejects.toMatchObject({ reason: 'modelUnavailable' });
  });

  it('maps a 401 generate call to a typed invalidKey error', async () => {
    const { fetchImpl } = mockFetch({ status: 401, json: { error: {} } });
    const provider = createGeminiProvider(fetchImpl);
    await expect(provider.analyze(analyzeRequest())).rejects.toMatchObject({
      reason: 'invalidKey',
    });
  });
});