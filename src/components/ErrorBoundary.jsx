// Copyright (c) 2025 Vision AI Mind. All rights reserved.
import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    
    // Enhanced error logging for debugging
    console.group('%c🚨 Vision AI Mind - Error Caught', 'color: #ef4444; font-weight: bold; font-size: 14px');
    console.error('Error:', error);
    console.error('Error Message:', error?.message);
    console.error('Error Stack:', error?.stack);
    if (errorInfo?.componentStack) {
      console.error('Component Stack:', errorInfo.componentStack);
    }
    console.groupEnd();
    
    // Optional: Send to error tracking service
    // if (window.Sentry) {
    //   window.Sentry.captureException(error, { extra: errorInfo });
    // }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-8 max-w-md text-center shadow-2xl">
            {/* Icon */}
            <div className="w-16 h-16 mx-auto mb-6 bg-red-500/10 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            
            {/* Title */}
            <h2 className="text-2xl font-bold text-white mb-3">
              Etwas ist schiefgelaufen
            </h2>
            
            {/* Description */}
            <p className="text-slate-400 mb-6">
              Keine Sorge – deine Daten sind sicher. 
              Lade die Seite neu, um fortzufahren.
            </p>
            
            {/* Error Details (collapsed) */}
            {this.state.error && (
              <details className="mb-6 text-left">
                <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-400">
                  Technische Details
                </summary>
                <div className="mt-2 space-y-2">
                  <pre className="p-3 bg-slate-800/50 rounded-lg text-xs text-red-300 overflow-auto max-h-24">
                    {this.state.error.toString()}
                  </pre>
                  {this.state.errorInfo?.componentStack && (
                    <details className="text-left">
                      <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400">
                        Component Stack
                      </summary>
                      <pre className="mt-1 p-2 bg-slate-800/30 rounded text-xs text-amber-300/80 overflow-auto max-h-32 whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              </details>
            )}
            
            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={this.handleGoHome}
                className="flex-1 py-3 border border-slate-600 rounded-xl text-slate-300 font-medium hover:bg-slate-800 transition"
              >
                Zur Startseite
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl text-white font-semibold hover:from-cyan-500 hover:to-blue-500 transition flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Neu laden
              </button>
            </div>
            
            {/* Brand */}
            <p className="mt-6 text-xs text-slate-600">
              Vision AI Mind © 2025
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
