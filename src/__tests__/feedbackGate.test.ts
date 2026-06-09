import { describe, it, expect } from 'vitest';
import { canSubmitFeedback } from '../pages/tradeAnalyzer/FeedbackGate';

describe('canSubmitFeedback (gate Submit-enablement)', () => {
  it('is false until the required winner-agreement is picked', () => {
    expect(canSubmitFeedback(null, false)).toBe(false);
  });
  it('is true once an agree option is picked and nothing is submitting', () => {
    expect(canSubmitFeedback('agree', false)).toBe(true);
    expect(canSubmitFeedback('disagree', false)).toBe(true);
    expect(canSubmitFeedback('unsure', false)).toBe(true);
  });
  it('is false while a submit is in flight, even with an option picked', () => {
    expect(canSubmitFeedback('agree', true)).toBe(false);
  });
});
