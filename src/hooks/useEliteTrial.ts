const STORAGE_KEY_STARTED = "visionai_eliteTrialStartedAt";
const STORAGE_KEY_DURATION = "visionai_eliteTrialDurationDays";
const DEFAULT_DAYS = 7;

const dayMs = 24 * 60 * 60 * 1000;

const formatRemaining = (ms: number) => {
  if (!Number.isFinite(ms) || ms <= 0) return "abgelaufen";
  const days = Math.floor(ms / dayMs);
  const hours = Math.floor((ms % dayMs) / (60 * 60 * 1000));
  return `${days} Tage ${hours}h`;
};

export function useEliteTrial() {
  const now = Date.now();
  let startedAt = localStorage.getItem(STORAGE_KEY_STARTED);
  let durationDays = Number(localStorage.getItem(STORAGE_KEY_DURATION) || DEFAULT_DAYS);

  if (!startedAt) {
    startedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY_STARTED, startedAt);
    localStorage.setItem(STORAGE_KEY_DURATION, String(DEFAULT_DAYS));
    durationDays = DEFAULT_DAYS;
  }

  const startedTs = Date.parse(startedAt);
  const expiresAt = Number.isFinite(startedTs) ? startedTs + durationDays * dayMs : now + DEFAULT_DAYS * dayMs;
  const remainingMs = Math.max(0, expiresAt - now);
  const isTrialActive = remainingMs > 0;

  return {
    isTrialActive,
    trialExpiresAt: new Date(expiresAt),
    remainingMs,
    remainingFormatted: formatRemaining(remainingMs),
    startedAt,
  };
}
