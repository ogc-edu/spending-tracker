/**
 * Plan 013 — DeepSeekProvider (BYOK, real network).
 *
 * OpenAI-compatible REST at a hardcoded base (AI-11): https://api.deepseek.com.
 * Auth is `Authorization: Bearer <key>` — a DeepSeek-native key format (their
 * own credential, NOT OAuth). API shape verified from the official docs
 * 2026-09-01; the catalog already renamed `deepseek-chat` → `deepseek-v4-*`,
 * so NO model ids are hardcoded here — discovery only (A13/A14).
 *
 * Capabilities (PRD AI-5 / AI-7 / AI-8):
 *  - listModels: GET /models, keeping text models (drop `*-vision-*` ids —
 *    image/vision models are out of scope for financial analysis);
 *  - testConnection: POST /chat/completions with max_tokens: 1 on the FIRST
 *    discovered model, returning a typed TestResult;
 *  - analyze: POST /chat/completions with response_format {type:'json_object'}
 *    when the model supports it; on a 400/422 (unsupported parameter) it
 *    retries WITHOUT response_format with the JSON contract prompt-embedded,
 *    then tolerantly extracts the first {...} block (plan §Edge cases) and
 *    returns that raw JSON text — the 012 facade still does the single,
 *    central Zod validation.
 */
import { AIUnavailableError, fromHttpStatus, fromInvalidResponse, fromNetworkError, fromTimeoutError, fromUnknown } from '../errors';
import type { AIAnalyzeRequest, AIProvider, ModelInfo, TestResult } from '../types';
import { HttpError, NetworkError, TimeoutError, extractJson, requestJson, stripFence, testResultFromError, type FetchLike } from './http';

const DEEPSEEK_BASE = 'https://api.deepseek.com';

/** Discovery filtering: vision/image models are not suitable for analysis. */
const VISION_MODEL = /vision/i;

/** Default timeouts: test/discovery are small calls; generate can take longer. */
const SHORT_TIMEOUT_MS = 20_000;
const GENERATE_TIMEOUT_MS = 60_000;

/** A 400/422 from the first attempt usually means response_format is unsupported. */
const RETRY_ON_STATUS = new Set([400, 422]);

export class DeepSeekProvider implements AIProvider {
  readonly name = 'deepseek' as const;

  constructor(
    private readonly fetchImpl: FetchLike = fetch,
    private readonly shortTimeoutMs = SHORT_TIMEOUT_MS,
    private readonly generateTimeoutMs = GENERATE_TIMEOUT_MS,
  ) {}

  /** GET /models → text models (non-vision), used verbatim (plan §Technical Design). */
  async listModels(key: string): Promise<ModelInfo[]> {
    const body = await this.guarded(
      requestJson(
        this.fetchImpl,
        `${DEEPSEEK_BASE}/models`,
        { headers: { authorization: `Bearer ${key}` } },
        this.shortTimeoutMs,
      ),
    );
    const data = (body as { data?: { id?: string }[] })?.data;
    if (!Array.isArray(data)) {
      throw fromInvalidResponse('DeepSeek models listing was not the expected shape');
    }
    return data
      .filter((m) => typeof m.id === 'string' && !VISION_MODEL.test(m.id))
      .map((m) => ({ id: m.id as string }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  /** Minimal real request on the FIRST model that accepts one (AI-7). */
  async testConnection(key: string): Promise<TestResult> {
    let models: ModelInfo[];
    try {
      models = await this.listModels(key);
    } catch (err) {
      return testResultFromError(err);
    }
    if (models.length === 0) return { ok: false, reason: 'modelUnavailable' };

    for (const model of models) {
      try {
        await this.chatCompletions(key, {
          model: model.id,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        });
        return { ok: true };
      } catch (err) {
        // A retired/unknown model id is a model-level rejection (404) — try
        // the next discovered model; auth/quota/network stop immediately.
        if (err instanceof HttpError && err.status === 404) continue;
        return testResultFromError(err);
      }
    }
    return { ok: false, reason: 'modelUnavailable' };
  }

  /** chat/completions with a JSON object response; returns RAW JSON text. */
  async analyze(request: AIAnalyzeRequest): Promise<string> {
    if (!request.modelId) {
      throw new AIUnavailableError(
        'modelUnavailable',
        'No DeepSeek model selected — pick one in Settings',
      );
    }
    const userContent = `Financial snapshot (JSON):\n${request.snapshot}`;
    const messages = [
      { role: 'system', content: request.systemPrompt },
      { role: 'user', content: userContent },
    ];

    // Attempt 1: structured JSON mode (deepseek JSON output — systemPrompt has
    // the word "JSON", which OpenAI-compatible providers require in-message).
    let body: unknown;
    try {
      body = await this.guarded(
        this.chatCompletions(request.key, {
          model: request.modelId,
          messages,
          response_format: { type: 'json_object' },
          stream: false,
        }),
      );
    } catch (err) {
      // Attempt 2: the model rejected response_format → prompt-embedded JSON
      // + tolerant extraction. Only retry on a parameter-level rejection, and
      // only once — a 401/404/429 retry would just mask the real error.
      if (!(err instanceof AIUnavailableError) || !err.status || !RETRY_ON_STATUS.has(err.status)) {
        throw err;
      }
      body = await this.guarded(
        this.chatCompletions(request.key, {
          model: request.modelId,
          messages: [
            ...messages,
            {
              role: 'user',
              content:
                'Respond with raw JSON only (no markdown fences) in exactly this shape: ' +
                '{"summary": string, "points": string[5]}.',
            },
          ],
          stream: false,
        }),
      );
    }

    const content = (body as {
      choices?: { message?: { content?: unknown } }[];
    })?.choices?.[0]?.message?.content;
    const text = typeof content === 'string' ? content : null;
    if (text == null || !text.trim()) {
      throw fromInvalidResponse('DeepSeek returned no text content');
    }

    // Tolerant parse (plan §Edge cases): verify the first {...} block is real
    // JSON, then hand the RAW text to the facade for the single Zod boundary.
    let block: string | null;
    try {
      block = extractJson(stripFence(text));
      if (block !== null) JSON.parse(block);
    } catch {
      block = null;
    }
    if (block !== null) return block;
    throw fromInvalidResponse('DeepSeek response was not valid JSON');
  }

  /** POST /chat/completions — throws classified errors. */
  private async chatCompletions(key: string, payload: unknown): Promise<unknown> {
    return requestJson(
      this.fetchImpl,
      `${DEEPSEEK_BASE}/chat/completions`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${key}`,
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

export function createDeepseekProvider(
  fetchImpl?: FetchLike,
  shortTimeoutMs?: number,
  generateTimeoutMs?: number,
): AIProvider {
  return new DeepSeekProvider(fetchImpl, shortTimeoutMs, generateTimeoutMs);
}