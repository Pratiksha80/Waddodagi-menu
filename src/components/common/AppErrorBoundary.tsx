import React from 'react';
import { reportClientError } from '../../services/errorReporting';

interface AppErrorBoundaryState { hasError: boolean }

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    reportClientError('react_error_boundary', error);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen bg-cream flex items-center justify-center px-5 text-center">
          <div className="max-w-md rounded-3xl border border-line bg-ivory p-8 shadow-xl">
            <h1 className="font-serif text-3xl text-ink">Something went wrong</h1>
            <p className="mt-3 text-sm text-muted">Please reload the menu. The issue has been reported to the shop owner when email alerts are configured.</p>
            <button type="button" onClick={() => window.location.reload()} className="btn-gold mt-6">Reload menu</button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
