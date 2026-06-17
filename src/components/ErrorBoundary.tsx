import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional custom fallback; receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time exceptions anywhere in the subtree so a single bad
 * component (or unexpected API data shape) shows a recoverable error screen
 * instead of white-screening the whole app. Network/IndexedDB failures are
 * handled in `LeagueContext` (the `error` state); this is the last-resort net
 * for the unexpected.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Dashboard crashed:', error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className='bg-surface-base text-white min-h-screen p-3 flex flex-col justify-center items-center gap-4'>
        <div className='text-xl font-semibold text-red-400 text-center'>
          Something went wrong
        </div>
        <div className='text-sm text-gray-400 text-center max-w-md'>
          The dashboard hit an unexpected error. Reloading usually fixes it.
        </div>
        <div className='flex items-center gap-3'>
          <button
            type='button'
            className='rounded-md border border-primary-main/70 px-3 py-1.5 text-sm text-primary-light hover:bg-primary-main/10 transition-colors'
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
          <button
            type='button'
            className='text-sm text-gray-400 underline hover:text-white'
            onClick={this.reset}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}
