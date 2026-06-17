import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ErrorBoundary } from '../components/ErrorBoundary';

function Boom(): never {
  throw new Error('kaboom');
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // The thrown render error is expected; silence the noisy console output.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <div>healthy</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('healthy')).toBeTruthy();
  });

  it('shows a recoverable fallback when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
  });

  it('supports a custom fallback with a reset callback', () => {
    render(
      <ErrorBoundary
        fallback={(error, reset) => (
          <button onClick={reset}>recover: {error.message}</button>
        )}
      >
        <Boom />
      </ErrorBoundary>
    );
    const btn = screen.getByText('recover: kaboom');
    expect(btn).toBeTruthy();
    // Clicking reset should not throw (child still throws, boundary re-catches).
    fireEvent.click(btn);
  });
});
