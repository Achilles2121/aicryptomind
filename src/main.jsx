import React, { Component } from "react";
import ReactDOM from "react-dom/client";
import PropTypes from "prop-types";
import App from "./App";
import "./index.css";
import { UserTierProvider } from "./context/UserTierContext";

// Build: v2.0.2 - Fixed infinite re-render loops

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("UI Error Boundary", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-6">
          <h1 className="text-2xl font-bold text-red-300">Etwas ist schiefgelaufen.</h1>
          <p className="mt-2 text-sm text-slate-300">
            Bitte lade die Seite neu. Falls das erneut passiert, schicke mir die Fehlermeldung aus
            der Browser-Konsole.
          </p>
          <pre className="mt-4 rounded-lg bg-slate-900 p-3 text-xs text-red-200">
            {String(this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <ErrorBoundary>
    <React.StrictMode>
      <UserTierProvider>
        <App />
      </UserTierProvider>
    </React.StrictMode>
  </ErrorBoundary>
);
