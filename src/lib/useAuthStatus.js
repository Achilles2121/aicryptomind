import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, fetchUserTier, setCachedUserTier, TRIAL_WINDOW_MS } from "../firebase";

const INITIAL_STATE = {
  user: null,
  loading: true,
  tier: "basic",
  trialStart: null,
  trialEndsAt: null,
  trialUsed: false,
};

const ELITE_OVERRIDE_EMAILS = new Set(["oemeralpay@hotmail.com"]);

export const useAuthStatus = () => {
  const [state, setState] = useState(() =>
    auth ? INITIAL_STATE : { ...INITIAL_STATE, loading: false }
  );
  const [now, setNow] = useState(() => Date.now());

  const loadUserTier = useCallback(async (uid, email = "") => {
    if (!uid) return;
    const normalizedEmail = email.toLowerCase?.() || email;
    if (normalizedEmail && ELITE_OVERRIDE_EMAILS.has(normalizedEmail)) {
      setCachedUserTier("elite");
      setState((prev) => ({
        ...prev,
        tier: "elite",
        trialStart: null,
        trialEndsAt: null,
        trialUsed: false,
        loading: false,
      }));
      return;
    }
    try {
      const profile = await fetchUserTier(uid);
      const normalizedStart = Number(profile.trialStart);
      const trialStart = Number.isFinite(normalizedStart) ? normalizedStart : null;
      const normalizedEnd = Number(profile.trialEndsAt);
      let trialEndsAt = null;
      if (Number.isFinite(normalizedEnd)) {
        trialEndsAt = normalizedEnd;
      } else if (trialStart) {
        trialEndsAt = trialStart + TRIAL_WINDOW_MS;
      }
      setState((prev) => ({
        ...prev,
        tier: profile.tier || "basic",
        trialStart,
        trialEndsAt,
        trialUsed: Boolean(profile.trialUsed || trialStart),
        loading: false,
      }));
    } catch (err) {
      console.error("loadUserTier failed", err);
      setCachedUserTier("basic");
      setState((prev) => ({
        ...prev,
        tier: "basic",
        trialStart: null,
        trialEndsAt: null,
        trialUsed: false,
        loading: false,
      }));
    }
  }, []);

  useEffect(() => {
    if (!auth) {
      setCachedUserTier("basic");
      return undefined;
    }
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setCachedUserTier("basic");
        setState({ ...INITIAL_STATE, loading: false });
        return;
      }
      setState((prev) => ({ ...prev, user: firebaseUser, loading: true }));
      loadUserTier(firebaseUser.uid, firebaseUser.email || "");
    });
    return () => unsub();
  }, [loadUserTier]);

  const refreshUserTier = useCallback(() => {
    if (state.user?.uid) {
      return loadUserTier(state.user.uid, state.user.email || "");
    }
    return Promise.resolve();
  }, [state.user, loadUserTier]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const derived = useMemo(() => {
    const trialEndsAt = state.trialEndsAt || (state.trialStart ? state.trialStart + TRIAL_WINDOW_MS : null);
    const isTrialActive = Boolean(trialEndsAt && now < trialEndsAt);
    const trialExpired = Boolean(state.trialStart && trialEndsAt && now >= trialEndsAt);
    const trialRemainingMs = trialEndsAt ? Math.max(0, trialEndsAt - now) : 0;
    const trialRemainingDays = trialEndsAt ? Math.max(0, Math.ceil(trialRemainingMs / (24 * 60 * 60 * 1000))) : 0;
    const effectiveTier = isTrialActive ? "elite" : state.tier;
    return { trialEndsAt, isTrialActive, trialExpired, trialRemainingMs, trialRemainingDays, effectiveTier };
  }, [now, state.trialEndsAt, state.trialStart, state.tier]);

  return useMemo(
    () => ({
      user: state.user,
      loading: state.loading,
      tier: state.tier,
      trialStart: state.trialStart,
      trialEndsAt: derived.trialEndsAt,
      trialUsed: state.trialUsed || Boolean(state.trialStart),
      isTrialActive: derived.isTrialActive,
      trialExpired: derived.trialExpired,
      trialRemainingMs: derived.trialRemainingMs,
      trialRemainingDays: derived.trialRemainingDays,
      effectiveTier: derived.effectiveTier,
      refreshUserTier,
    }),
    [state, derived, refreshUserTier]
  );
};

export default useAuthStatus;
