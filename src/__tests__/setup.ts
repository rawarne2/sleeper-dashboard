import { vi } from 'vitest';

// Node 25 exposes a partial localStorage stub (getter-only, no .clear/.setItem etc.)
// that Vitest's jsdom environment does not override. Replace it with a proper
// in-memory implementation so browser-storage tests work regardless of Node version.
function makeStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  } as Storage;
}

vi.stubGlobal('localStorage', makeStorage());
vi.stubGlobal('sessionStorage', makeStorage());
