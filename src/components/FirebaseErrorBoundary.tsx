import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class FirebaseErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'An unexpected application error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Workspace ErrorBoundary caught error:', error, info);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    let formattedDetail = this.state.message;
    try {
      const parsed = JSON.parse(this.state.message) as {
        error?: string;
        operationType?: string;
        path?: string;
      };
      if (parsed.error && parsed.operationType) {
        formattedDetail = `Firestore ${parsed.operationType} failed at "${parsed.path || '/'}": ${parsed.error}`;
      }
    } catch {
      // Plain error message
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--surface-canvas)] text-[var(--text-main)]">
        <div className="max-w-lg w-full surface-panel rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 text-[var(--status-error)]">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <h1 className="font-display font-bold text-lg">Workspace Recovery</h1>
          </div>
          <p className="text-sm text-[var(--text-secondary)] break-words">
            {formattedDetail}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-xl text-sm font-semibold"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--accent-contrast)',
            }}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reload Workspace View</span>
          </button>
        </div>
      </div>
    );
  }
}
