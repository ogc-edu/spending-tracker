/**
 * Plan 016 — aiStatusLabel (the Settings AI status line, SET-2). Pure
 * function tests: key presence flips the label; the provider name is the
 * display label ("Gemini" / "DeepSeek").
 */
import { describe, expect, it } from '@jest/globals';
import { aiStatusLabel } from '../providerMeta';

describe('aiStatusLabel (plan 016 / SET-2)', () => {
  it('reads "· key configured" when a key is present', () => {
    expect(aiStatusLabel('gemini', true)).toBe('Gemini · key configured');
    expect(aiStatusLabel('deepseek', true)).toBe('DeepSeek · key configured');
  });

  it('reads "· key not configured" when absent', () => {
    expect(aiStatusLabel('gemini', false)).toBe('Gemini · key not configured');
    expect(aiStatusLabel('deepseek', false)).toBe('DeepSeek · key not configured');
  });
});