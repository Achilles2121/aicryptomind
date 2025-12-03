import React, { Component } from "react";
import ReactDOM from "react-dom/client";
import PropTypes from "prop-types";
import App from "./App";
import "./index.css";
import { UserTierProvider } from "./context/UserTierContext";
import { SubscriptionProvider } from "./context/SubscriptionContext";
import { useUserTier } from "./context/UserTierContext";

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
      const msg = this.state.error ? String(this.state.error?.message || this.state.error) : "Unbekannter Fehler";
      return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-6">
          <h1 className="text-2xl font-bold text-red-300">Etwas ist schiefgelaufen.</h1>
          <p className="mt-2 text-sm text-slate-300">
            Bitte lade die Seite neu. Falls das erneut passiert, schicke mir die Fehlermeldung aus
            der Browser-Konsole.
          </p>
          <pre className="mt-4 rounded-lg bg-slate-900 p-3 text-xs text-red-200 whitespace-pre-wrap break-all">
            {msg}
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

function SubscriptionBridge({ children }) {
  const tierState = useUserTier();
  const backendSnapshot = {
    plan: tierState?.tier || "basic",
    tier: tierState?.tier || "basic",
    trialStartedAt: tierState?.trialStart || null,
    trialStart: tierState?.trialStart || null,
    trialEndsAt: tierState?.trialEndsAt || null,
    isTrialActive: tierState?.isTrialActive || false,
    loading: tierState?.loading || false,
  };
  return (
    <SubscriptionProvider backendState={backendSnapshot} env={import.meta.env?.MODE || "development"}>
      {children}
    </SubscriptionProvider>
  );
}

SubscriptionBridge.propTypes = {
  children: PropTypes.node.isRequired,
};

root.render(
  <ErrorBoundary>
    <UserTierProvider>
      <SubscriptionBridge>
        <App />
      </SubscriptionBridge>
    </UserTierProvider>
  </ErrorBoundary>
);
