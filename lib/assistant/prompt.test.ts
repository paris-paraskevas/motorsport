import { describe, it, expect } from 'vitest';
import {
  ASSISTANT_SYSTEM_PROMPT,
  buildSystemPrompt,
  normalizeConversation,
  ASSISTANT_MAX_TURNS,
  ASSISTANT_MIN_QUESTION_LEN,
  ASSISTANT_MAX_QUESTION_LEN,
  type ChatMessage,
} from './prompt';

// The guardrails ARE the feature — Paddock's accuracy bar means an assistant
// that invents race data is worse than none. Lock the contract in the prompt.
describe('ASSISTANT_SYSTEM_PROMPT', () => {
  it('forbids answering live data from memory', () => {
    expect(ASSISTANT_SYSTEM_PROMPT).toMatch(/NEVER state live/i);
    expect(ASSISTANT_SYSTEM_PROMPT.toLowerCase()).toContain('standings');
    expect(ASSISTANT_SYSTEM_PROMPT.toLowerCase()).toContain('results');
  });

  it('requires grounding in the provided context and refusing when uncovered', () => {
    expect(ASSISTANT_SYSTEM_PROMPT.toLowerCase()).toContain('only from the site help');
    expect(ASSISTANT_SYSTEM_PROMPT.toLowerCase()).toMatch(/don't guess|do not guess/);
  });
});

describe('buildSystemPrompt', () => {
  it('embeds the corpus alongside the guardrails', () => {
    const out = buildSystemPrompt('CORPUS_BODY');
    expect(out).toContain('CORPUS_BODY');
    expect(out).toMatch(/NEVER state live/i);
    expect(out.toLowerCase()).toContain('site help');
  });

  it('has sane bounds', () => {
    expect(ASSISTANT_MIN_QUESTION_LEN).toBeGreaterThan(0);
    expect(ASSISTANT_MAX_QUESTION_LEN).toBeGreaterThan(ASSISTANT_MIN_QUESTION_LEN);
    expect(ASSISTANT_MAX_TURNS).toBeGreaterThan(1);
  });
});

describe('normalizeConversation', () => {
  it('drops malformed entries, trims, and preserves order', () => {
    const raw = [
      { role: 'user', content: '  hi  ' },
      { role: 'assistant', content: 'hello' },
      { role: 'bogus', content: 'x' },
      { role: 'user', content: '   ' },
    ] as ChatMessage[];
    expect(normalizeConversation(raw)).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ]);
  });

  it('caps to the last ASSISTANT_MAX_TURNS messages', () => {
    const many: ChatMessage[] = Array.from({ length: ASSISTANT_MAX_TURNS + 5 }, (_, i) => ({
      role: 'user',
      content: `q${i}`,
    }));
    const out = normalizeConversation(many);
    expect(out).toHaveLength(ASSISTANT_MAX_TURNS);
    expect(out[out.length - 1].content).toBe(`q${ASSISTANT_MAX_TURNS + 4}`);
  });
});
