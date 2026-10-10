import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          maxWidth: '680px',
          margin: '40px auto',
          padding: '28px',
          background: 'var(--ui-panel, #ffffff)',
          border: '1px solid var(--ui-border, #e2e8f0)',
          borderRadius: '12px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
          textAlign: 'center',
          fontFamily: 'inherit'
        }}>
          <h2 style={{ color: 'var(--ui-text, #1e293b)', marginBottom: '12px', fontSize: '20px' }}>
            Something went wrong while rendering this section
          </h2>
          <p style={{ color: 'var(--ui-text-muted, #64748b)', fontSize: '14px', marginBottom: '20px' }}>
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                background: 'var(--color-primary, #16a34a)',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Reload View
            </button>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                if (this.props.onGoHome) this.props.onGoHome();
                else window.location.href = '/';
              }}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                background: 'var(--ui-surface-muted, #f1f5f9)',
                color: 'var(--ui-text, #1e293b)',
                border: '1px solid var(--ui-border, #e2e8f0)',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Return Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
