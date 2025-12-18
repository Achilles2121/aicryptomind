/**
 * Elite Trial Hook - Firebase-based trial system
 * 
 * Trial is ONLY available for logged-in users and stored in Firebase.
 * No localStorage-based trials anymore to prevent abuse.
 * 
 * For non-logged-in users: Always returns basic tier (no trial)
 */

const TRIAL_DURATION_DAYS = 7;
const dayMs = 24 * 60 * 60 * 1000;

const formatRemaining = (ms: number) => {
  if (!Number.isFinite(ms) || ms <= 0) return "abgelaufen";
  const days = Math.floor(ms / dayMs);
  const hours = Math.floor((ms % dayMs) / (60 * 60 * 1000));
  if (days > 0) return `${days} Tage ${hours}h`;
  const mins = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  return `${hours}h ${mins}m`;
};

interface TrialData {
  trialStart: string | null;
  trialEndsAt: string | null;
  trialUsed: boolean;
}

// This hook now just formats the trial data from Firebase
// The actual trial state comes from UserTierContext
export function useEliteTrial(firebaseTrialData?: TrialData | null) {
  const now = Date.now();
  
  // No trial data = no trial
  if (!firebaseTrialData || !firebaseTrialData.trialStart) {
    return {
      isTrialActive: false,
      trialExpiresAt: null,
      remainingMs: 0,
      remainingFormatted: "nicht gestartet",
      startedAt: null,
      trialUsed: firebaseTrialData?.trialUsed || false,
    };
  }

  const { trialStart, trialEndsAt, trialUsed } = firebaseTrialData;
  
  // If trial was already used and ended, no more trial
  if (trialUsed && trialEndsAt) {
    const endsAtTs = Date.parse(trialEndsAt);
    if (now > endsAtTs) {
      return {
        isTrialActive: false,
        trialExpiresAt: new Date(endsAtTs),
        remainingMs: 0,
        remainingFormatted: "abgelaufen",
        startedAt: trialStart,
        trialUsed: true,
      };
    }
  }

  const startedTs = Date.parse(trialStart);
  const expiresAt = trialEndsAt 
    ? Date.parse(trialEndsAt) 
    : (Number.isFinite(startedTs) ? startedTs + TRIAL_DURATION_DAYS * dayMs : now);
  
  const remainingMs = Math.max(0, expiresAt - now);
  const isTrialActive = remainingMs > 0;

  return {
    isTrialActive,
    trialExpiresAt: new Date(expiresAt),
    remainingMs,
    remainingFormatted: formatRemaining(remainingMs),
    startedAt: trialStart,
    trialUsed: trialUsed || false,
  };
}

export const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * dayMs;

