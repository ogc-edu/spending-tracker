/**
 * Plan 013 — GeminiProvider (BYOK, real network).
 *
 * API-key auth via `x-goog-api-key` — NEVER OAuth (A13; AQ-format Google AI
 * Studio keys live-verified against v1beta 2026-09-01). Base is hardcoded
 * (AI-11, no custom base URL): https://generativelanguage.googleapis.com/v1beta
 *
 * Capabilities (PRD AI-5 / AI-7 / AI-8):
 *  - listModels: GET /models filtered to text generation — nothing hardcoded;
 *  - testConnection: 1-token generateContent on the FIRST suitable model,
 *    returning a typed TestResult (invalidKey / quota / modelUnavailable /
 *    network / unknown);
 *  - analyze: generateContent with responseMimeType 'application/json'; the
 *    RAW JSON text comes back and the 012 facade parses + Zod-validates it.
 *
 * Raw REST on purpose (plan §Technical Design): the SDK surface adds nothing.
 * Keys travel only in the request header and the analyze request object —
 * never logged, committed, or included in errors.
 */
import { AIUnavailableError, fromHttpStatus, fromInvalidResponse, fromNetworkError, fromTimeoutError, fromUnknown } from '../errors';
import type { AIAnalyzeRequest, AIProvider, ModelInfo, TestOptions, TestResult } from '../types';
import { HttpError, NetworkError, RequestCancelledError, TimeoutError, requestJson, testResultFromError, type FetchLike } from './http';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Discovery filtering (plan §Technical Design): text generation only.
 *
 * This is a moving-target heuristic — the 2026-09 catalog adds non-text
 * families beyond the plan's original list (deep-research, robotics,
 * computer-use, lyria/music, nano-banana/gaming, antigravity, transcribe,
 * customtools). testConnection additionally SKIPS models that reject
 * generateContent at runtime (400/404), so a stale exclusion can never break
 * the Test button.
 */
const NON_TEXT_MODEL =
  /embedding|image|audio|video|imagen|tts|speech|deep-research|computer-use|robotics|customtools|lyria|banana|antigravity|transcribe/i;

/** Default timeouts: test/discovery are small calls; generate can take longer. */
const SHORT_TIMEOUT_MS = 20_000;
const GENERATE_TIMEOUT_MS = 60_000;

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini' as const;

  constructor(
    private readonly fetchImpl: FetchLike = fetch,
    private readonly shortTimeoutMs = SHORT_TIMEOUT_MS,
    private readonly generateTimeoutMs = GENERATE_TIMEOUT_MS,
  ) {}

  /** GET /models → text-generation models, sorted by id (discovery only). */
  async listModels(key: string, signal?: AbortSignal): Promise<ModelInfo[]> {
    const body = await this.guarded(
      requestJson(
        this.fetchImpl,
        `${GEMINI_BASE}/models`,
        { headers: { 'x-goog-api-key': key } },
        this.shortTimeoutMs,
        signal,
      ),
    );
    const models = (body as { models?: { name?: string; supportedGenerationMethods?: string[] }[] })
      ?.models;
    if (!Array.isArray(models)) {
      throw fromInvalidResponse('Gemini models listing was not the expected shape');
    }
    return models
      .filter(
        (m) =>
          typeof m.name === 'string' &&
          m.supportedGenerationMethods?.includes('generateContent') === true &&
          !NON_TEXT_MODEL.test(m.name),
      )
      .map((m) => {
        // name is a string here: the filter above narrowed it, but TS cannot
        // carry that through the array methods — strip the `models/` prefix.
        const id = (m.name as string).replace(/^models\//, '');
        return { id, label: id };
      })
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  /**
   * Minimal real request on the FIRST model that accepts one (AI-7).
   *
   * Discovery lists models that are not callable via generateContent: preview
   * families restricted to the Interactions API (HTTP 400) and retired
   * generations that 404 with "no longer available to new users". Those are
   * model-level rejections — skip to the next suitable model. 401/403/429 and
   * network/timeout failures are key/account-level and stop immediately.
   */
  async testConnection(key: string, options?: TestOptions): Promise<TestResult> {
    let models: ModelInfo[];
    try {
      options?.onStep?.({ phase: 'discovering' });
      models = await this.listModels(key, options?.signal);
    } catch (err) {
      if (err instanceof RequestCancelledError) throw err;
      return testResultFromError(err);
    }
    if (models.length === 0) return { ok: false, reason: 'modelUnavailable' };

    for (const model of models) {
      options?.onStep?.({ phase: 'testing', modelId: model.id });
      try {
        await this.generateContent(key, model.id, {
          contents: [{ parts: [{ text: 'ok' }] }],
          generationConfig: { maxOutputTokens: 1 },
        }, options?.signal);
        return { ok: true };
      } catch (err) {
        if (err instanceof RequestCancelledError) throw err;
        if (err instanceof HttpError && (err.status === 400 || err.status === 404)) {
          // Model-level rejection — report it live, try the next discovered model.
          options?.onStep?.({ phase: 'unavailable', modelId: model.id });
          continue;
        }
        return testResultFromError(err);
      }
    }
    return { ok: false, reason: 'modelUnavailable' };
  }

  /** generateContent with a JSON response; returns the RAW JSON text string. */
  async analyze(request: AIAnalyzeRequest): Promise<string> {
    if (!request.modelId) {
      throw new AIUnavailableError(
        'modelUnavailable',
        'No Gemini model selected — pick one in Settings',
      );
    }
    // Plan 019 — the user's question (when present) is a DISTINCT part after
    // the snapshot; the fixed systemInstruction is never interpolated.
    const parts = [{ text: `Financial snapshot (JSON):\n${request.snapshot}` }];
    if (request.question) parts.push({ text: `User question: ${request.question}` });
    const body = await this.guarded(
      this.generateContent(request.key, request.modelId, {
        contents: [{ parts }],
        systemInstruction: { parts: [{ text: request.systemPrompt }] },
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 2048 },
      }),
    );
    const candidates = (body as {
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
    })?.candidates;
    // Plan 019 fix — drop reasoning/thought parts. A thinking model can return a
    // `thought: true` part before the answer; joining it with the JSON would
    // corrupt the payload (invalidResponse).
    const text =
      candidates?.[0]?.content?.parts
        ?.filter((p) => p.thought !== true)
        .map((p) => p.text ?? '')
        .join('') ?? '';
    if (!text.trim()) {
      throw fromInvalidResponse('Gemini returned no text content');
    }
    return text.trim();
  }

  /** POST /models/{id}:generateContent — throws classified errors. */
  private async generateContent(
    key: string,
    modelId: string,
    payload: unknown,
    signal?: AbortSignal,
  ): Promise<unknown> {
    return requestJson(
      this.fetchImpl,
      `${GEMINI_BASE}/models/${encodeURIComponent(modelId)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': key,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
      this.generateTimeoutMs,
      signal,
    );
  }

  /** Map transport/HTTP failures to the 012 typed taxonomy (AI-4); cancellations pass through. */
  private async guarded<T>(promise: Promise<T>): Promise<T> {
    try {
      return await promise;
    } catch (err) {
      if (err instanceof RequestCancelledError) throw err;
      if (err instanceof HttpError) throw fromHttpStatus(err.status);
      if (err instanceof TimeoutError) throw fromTimeoutError(err);
      if (err instanceof NetworkError) throw fromNetworkError(err);
      if (err instanceof AIUnavailableError) throw err;
      throw fromUnknown(err);
    }
  }
}

export function createGeminiProvider(
  fetchImpl?: FetchLike,
  shortTimeoutMs?: number,
  generateTimeoutMs?: number,
): AIProvider {
  return new GeminiProvider(fetchImpl, shortTimeoutMs, generateTimeoutMs);
}