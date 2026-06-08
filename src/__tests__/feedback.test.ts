// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { getClientId } from '../services/clientId';

describe('getClientId', () => {
  beforeEach(() => localStorage.clear());
  it('creates and persists a stable id', () => {
    const a = getClientId();
    expect(a).toMatch(/[0-9a-f-]{8,}/i);
    expect(getClientId()).toBe(a);  // stable across calls
  });
});
