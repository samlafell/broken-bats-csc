import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    // #region agent log
    fetch('http://127.0.0.1:7613/ingest/5b90fa54-6c67-43c2-9e12-8404ec8a797f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'890096'},body:JSON.stringify({sessionId:'890096',location:'ErrorBoundary.tsx:componentDidCatch',message:'ErrorBoundary caught error',data:{errorMessage:error.message,errorStack:error.stack,componentStack:info.componentStack,errorName:error.name},timestamp:Date.now(),hypothesisId:'H1-H4'})}).catch(()=>{});
    // #endregion
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', color: '#fafaf9', background: '#0c0a09', minHeight: '100vh' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Something went wrong</h1>
          <pre style={{ background: '#1c1917', padding: '1rem', borderRadius: '0.5rem', overflow: 'auto', fontSize: '0.875rem', color: '#ef4444', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {this.state.error?.message}
            {'\n\n--- Stack Trace ---\n'}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', background: '#d97706', color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
