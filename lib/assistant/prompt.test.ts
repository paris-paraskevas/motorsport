import { describe, it, expect } from 'vitest';
import {
  ASSISTANT_SYSTEM_PROMPT,
  buildUserContent,
  ASSISTANT_MIN_QUESTION_LEN,
  ASSISTANT_MAX_QUESTION_LEN,
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

describe('buildUserContent', () => {
  it('embeds the corpus and the question', () => {
    const out = buildUserContent('CORPUS_BODY', 'how do I follow a series?');
    expect(out).toContain('CORPUS_BODY');
    expect(out).toContain('how do I follow a series?');
    expect(out.toLowerCase()).toContain('site help');
  });

  it('has sane question-length bounds', () => {
    expect(ASSISTANT_MIN_QUESTION_LEN).toBeGreaterThan(0);
    expect(ASSISTANT_MAX_QUESTION_LEN).toBeGreaterThan(ASSISTANT_MIN_QUESTION_LEN);
  });
});
