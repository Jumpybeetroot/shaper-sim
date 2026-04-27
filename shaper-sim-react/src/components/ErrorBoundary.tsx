import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ShaperSim ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          background: '#0f111a',
          color: '#f8f9fa',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          fontFamily: '"Inter", sans-serif'
        }}>
          <h1 style={{ color: '#ff3366', fontSize: '1.5rem' }}>Something went wrong</h1>
          <p style={{ color: '#adb5bd', maxWidth: '500px' }}>
            The simulator encountered an unexpected error. This is usually caused by corrupted saved state.
          </p>
          <pre style={{
            background: 'rgba(255,255,255,0.05)',
            padding: '16px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            color: '#ff6b6b',
            maxWidth: '600px',
            overflow: 'auto',
            textAlign: 'left'
          }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => {
              localStorage.removeItem('shaperSim_state');
              window.location.reload();
            }}
            style={{
              background: '#00f0ff',
              color: '#0f111a',
              border: 'none',
              padding: '10px 24px',
              borderRadius: '6px',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            Reset &amp; Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
