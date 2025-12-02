import React, { createContext, useEffect, useMemo, useState } from "react";
import { loadTrialState, saveTrialState } from "../services/trialService";

const TRIAL_DAYS = 7;
const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

const defaultState = {
  plan: "trial",
  trialStartedAt: null,
};

export const SubscriptionContext = createContext({
  plan: "trial",
  setPlan: () => {},
  trialEndsAt: Date.now(),
  trialDaysLeft: TRIAL_DAYS,
  trialActive: true,
  trialExpired: false,
  eliteTier: false,
  startTrial: () => {},
  hasFeature: () => true,
});

const featureMatrix = {
  trial: ["prices", "charts", "indicators", "etf-basic"],
  basic: ["prices", "charts", "indicators", "etf-basic", "flows"],
  elite: ["prices", "charts", "indicators", "etf-basic", "flows", "correlations", "alerts"],
};

export function SubscriptionProvider({ children }) {
  const [state, setState] = useState(defaultState);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    loadTrialState()
      .then((loaded) => {
        if (!mounted) return;
        const resolvedStart = loaded.trialStartedAt ?? null;
        setState({
          plan: loaded.plan ?? "trial",
          trialStartedAt: resolvedStart,
        });
      })
      .catch(() => {
        // fall back to defaults
        setState(defaultState);
      })
      .finally(() => setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    saveTrialState(state);
  }, [state, loading]);

  const trialEndsAt = useMemo(() => {
    if (!state.trialStartedAt) return 0;
    return state.trialStartedAt + TRIAL_MS;
  }, [state.trialStartedAt]);

  const trialDaysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt - Date.now()) / (24 * 60 * 60 * 1000)))
    : TRIAL_DAYS;
  const trialActive = Boolean(state.trialStartedAt) && Date.now() <= trialEndsAt && state.plan === "trial";
  const trialExpired = Boolean(state.trialStartedAt) && Date.now() > trialEndsAt;
  const eliteTier = trialActive || state.plan === "elite";

  const value = useMemo(
    () => ({
      plan: state.plan,
      trialEndsAt,
      trialDaysLeft,
      trialActive,
      trialExpired,
      eliteTier,
      setPlan: (plan) =>
        setState((prev) => ({
          ...prev,
          plan,
          trialStartedAt: plan === "trial" && !prev.trialStartedAt ? Date.now() : prev.trialStartedAt,
        })),
      startTrial: () =>
        setState((prev) => ({
          ...prev,
          plan: "trial",
          trialStartedAt: prev.trialStartedAt ?? Date.now(),
        })),
      hasFeature: (feature) =>
        eliteTier ||
        featureMatrix[state.plan]?.includes(feature) ||
        featureMatrix.elite.includes(feature),
    }),
    [state.plan, trialActive, trialExpired, eliteTier, trialEndsAt, trialDaysLeft]
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}
