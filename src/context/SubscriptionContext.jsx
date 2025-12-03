import React, { createContext, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { loadTrialState, saveTrialState } from "../services/trialService";

const TRIAL_DAYS = 7;
const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

const defaultState = {
  plan: "trial",
  trialStartedAt: null,
  trialEndsAt: null,
};

export const SubscriptionContext = createContext({
  plan: "trial",
  setPlan: () => {},
  trialEndsAt: null,
  trialDaysLeft: TRIAL_DAYS,
  trialActive: false,
  trialExpired: false,
  backendTrialValid: false,
  eliteTier: false,
  startTrial: () => {},
  updateFromBackend: () => {},
  hasFeature: () => true,
});

const featureMatrix = {
  trial: ["prices", "charts", "indicators", "etf-basic"],
  basic: ["prices", "charts", "indicators", "etf-basic", "flows"],
  elite: ["prices", "charts", "indicators", "etf-basic", "flows", "correlations", "alerts"],
};

export function SubscriptionProvider({ children, backendState = null, env = import.meta.env?.MODE || "development" }) {
  const backendReady = backendState && !backendState.loading;
  const backendPlan = backendReady ? backendState.plan || backendState.tier || "basic" : null;
  const backendTrialStart = backendReady
    ? backendState.trialStartedAt ?? backendState.trialStart ?? null
    : null;
  const backendTrialEndsAt = backendReady
    ? backendState.trialEndsAt ?? null
    : null;
  const [state, setState] = useState(() => {
    if (backendReady) {
      return {
        plan: backendPlan,
        trialStartedAt: backendTrialStart,
        trialEndsAt: backendTrialEndsAt,
      };
    }
    return defaultState;
  });
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let mounted = true;
    const allowLocal = env !== "production" && !backendReady;
    if (!allowLocal) {
      setLoading(false);
      return () => {};
    }
    loadTrialState()
      .then((loaded) => {
        if (!mounted) return;
        const resolvedStart = loaded.trialStartedAt ?? null;
        setState({
          plan: loaded.plan ?? defaultState.plan,
          trialStartedAt: resolvedStart,
          trialEndsAt: loaded.trialEndsAt ?? null,
        });
      })
      .catch(() => {
        setState(defaultState);
      })
      .finally(() => setLoading(false));
    return () => {
      mounted = false;
    };
  }, [backendReady, env]);

  useEffect(() => {
    if (!backendReady) return;
    setState((prev) => ({
      plan: backendPlan || prev.plan,
      trialStartedAt: backendTrialStart ?? prev.trialStartedAt,
      trialEndsAt: backendTrialEndsAt ?? prev.trialEndsAt ?? (backendTrialStart ? backendTrialStart + TRIAL_MS : null),
    }));
  }, [backendReady, backendPlan, backendTrialStart, backendTrialEndsAt]);

  useEffect(() => {
    const allowLocal = env !== "production" && !backendReady;
    if (loading || !allowLocal) return;
    saveTrialState(state);
  }, [state, loading, backendReady, env]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const trialEndsAt = useMemo(() => {
    if (state.trialEndsAt) return state.trialEndsAt;
    if (!state.trialStartedAt) return null;
    return state.trialStartedAt + TRIAL_MS;
  }, [state.trialEndsAt, state.trialStartedAt]);

  const backendTrialValid = useMemo(() => {
    if (!backendReady) return false;
    if (typeof backendState.isTrialActive === "boolean") return backendState.isTrialActive;
    if (backendTrialEndsAt && backendTrialStart) {
      const nowTs = Date.now();
      return nowTs >= backendTrialStart && nowTs <= backendTrialEndsAt;
    }
    return false;
  }, [backendReady, backendState, backendTrialEndsAt, backendTrialStart]);

  const { trialDaysLeft, trialActive, trialExpired } = useMemo(() => {
    if (!trialEndsAt || !state.trialStartedAt) {
      return { trialDaysLeft: TRIAL_DAYS, trialActive: false, trialExpired: false };
    }
    const diffMs = trialEndsAt - now;
    const daysLeft = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
    const active = diffMs >= 0 && state.plan === "trial";
    return { trialDaysLeft: daysLeft, trialActive: active, trialExpired: !active };
  }, [now, trialEndsAt, state.plan, state.trialStartedAt]);

  const eliteTier =
    state.plan === "elite" || (state.plan === "trial" && trialActive && backendTrialValid);

  const value = useMemo(
    () => ({
      plan: state.plan,
      trialEndsAt,
      trialDaysLeft,
      trialActive,
      trialExpired,
      backendTrialValid,
      eliteTier,
      setPlan: (plan) =>
        setState((prev) => ({
          ...prev,
          plan,
          trialStartedAt: plan === "trial" && !prev.trialStartedAt ? Date.now() : prev.trialStartedAt,
        })),
      startTrial: (payload) =>
        setState((prev) => {
          const allowLocal = env !== "production";
          if (prev.trialStartedAt) return prev;
          if (!payload?.trialStartedAt && !allowLocal) return prev;
          const startedAt = payload?.trialStartedAt ?? payload?.trialStart ?? Date.now();
          const endsAt = payload?.trialEndsAt ?? prev.trialEndsAt ?? startedAt + TRIAL_MS;
          return { ...prev, plan: "trial", trialStartedAt: startedAt, trialEndsAt: endsAt };
        }),
      updateFromBackend: (snapshot) => {
        if (!snapshot) return;
        const start = snapshot.trialStartedAt ?? snapshot.trialStart ?? null;
        const end = snapshot.trialEndsAt ?? (start ? start + TRIAL_MS : null);
        const plan = snapshot.plan || snapshot.tier || "basic";
        setState({ plan, trialStartedAt: start, trialEndsAt: end });
      },
      hasFeature: (feature) =>
        eliteTier ||
        featureMatrix[state.plan]?.includes(feature) ||
        featureMatrix.elite.includes(feature),
    }),
    [state.plan, trialActive, trialExpired, eliteTier, trialEndsAt, trialDaysLeft, backendTrialValid, env]
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

SubscriptionProvider.propTypes = {
  children: PropTypes.node.isRequired,
  backendState: PropTypes.shape({
    plan: PropTypes.string,
    tier: PropTypes.string,
    trialStartedAt: PropTypes.number,
    trialStart: PropTypes.number,
    trialEndsAt: PropTypes.number,
    isTrialActive: PropTypes.bool,
    loading: PropTypes.bool,
  }),
  env: PropTypes.string,
};
