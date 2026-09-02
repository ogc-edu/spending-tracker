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
import type { AIAnalyzeRequest, AIProvider, ModelInfo, TestResult } from '../types';
import { HttpError, NetworkError, TimeoutError, requestJson, testResultFromError, type FetchLike } from './http';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/** Discovery filtering (plan §Technical Design): text generation only. */
const NON_TEXT_MODEL = /embedding|image|audio|video|imagen|tts|speech/i;

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
  async listModels(key: string): Promise<ModelInfo[]> {
    const body = await this.guarded(
      requestJson(
        this.fetchImpl,
        `${GEMINI_BASE}/models`,
        { headers: { 'x-goog-api-key': key } },
        this.shortTimeoutMs,
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

  /** Minimal real request on the FIRST discovered model (AI-7). */
  async testConnection(key: string): Promise<TestResult> {
    let first: string;
    try {
      const models = await this.listModels(key);
      first = models[0]?.id ?? '';
    } catch (err) {
      return testResultFromError(err);
    }
    if (!first) return { ok: false, reason: 'modelUnavailable' };
    try {
      await this.generateContent(key, first, {
        contents: [{ parts: [{ text: 'ok' }] }],
        generationConfig: { maxOutputTokens: 1 },
      });
      return { ok: true };
    } catch (err) {
      return testResultFromError(err);
    }
  }

  /** generateContent with a JSON response; returns the RAW JSON text string. */
  async analyze(request: AIAnalyzeRequest): Promise<string> {
    if (!request.modelId) {
      throw new AIUnavailableError(
        'modelUnavailable',
        'No Gemini model selected — pick one in Settings',
      );
    }
    const body = await this.guarded(
      this.generateContent(request.key, request.modelId, {
        contents: [{ parts: [{ text: `Financial snapshot (JSON):\n${request.snapshot}` }] }],
        systemInstruction: { parts: [{ text: request.systemPrompt }] },
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 2048 },
      }),
    );
    const candidates = (body as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    })?.candidates;
    const text = candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
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
    );
  }

  /** Map transport/HTTP failures to the 012 typed taxonomy (AI-4). */
  private async guarded<T>(promise: Promise<T>): Promise<T> {
    try {
      return await promise;
    } catch (err) {
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