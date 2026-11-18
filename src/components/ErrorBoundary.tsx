import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected application error.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stone-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-8">
            <h1 className="text-xl font-semibold tracking-tight mb-2">
              Dogoggorri uumameera / Something went wrong
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-5 leading-relaxed">
              Daataa fe&apos;uu ykn tajaajila waliin walqunnamuu irratti rakkoon mudateera.
            </p>
            <pre className="text-xs font-mono bg-stone-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 overflow-x-auto text-zinc-700 dark:text-zinc-300 mb-6">
              {this.state.errorMessage}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium bg-blue-700 hover:bg-blue-800 text-white rounded-lg transition-colors"
            >
              Irra Deebi&apos;ii Bani / Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
