import { initializeApp } from "firebase/app";
import { doc, getDoc, getFirestore, setDoc } from "firebase/firestore";

const TRIAL_KEY = "elite-subscription";
const USER_KEY = "elite-user-id";
const TRIAL_USED_KEY = "elite-trial-used"; // Separate key to track if trial was ever used
const DEVICE_FINGERPRINT_KEY = "elite-device-fp"; // Device fingerprint

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const firebaseEnabled = Object.values(firebaseConfig).every(Boolean);
let firestore = null;

if (firebaseEnabled) {
  try {
    const app = initializeApp(firebaseConfig);
    firestore = getFirestore(app);
  } catch (error) {
    console.warn("Firebase init failed, falling back to local storage", error);
  }
}

/**
 * Generate a simple browser fingerprint to prevent easy trial abuse
 */
const generateFingerprint = () => {
  try {
    const nav = typeof globalThis.navigator !== "undefined" ? globalThis.navigator : {};
    const screen = typeof globalThis.window !== "undefined" ? globalThis.window.screen : {};
    const data = [
      nav.userAgent || "",
      nav.language || "",
      screen.width || 0,
      screen.height || 0,
      screen.colorDepth || 0,
      new Date().getTimezoneOffset(),
      nav.hardwareConcurrency || 0,
    ].join("|");
    // Simple hash
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `fp-${Math.abs(hash).toString(36)}`;
  } catch {
    return `fp-${Date.now()}`;
  }
};

/**
 * Get or create device fingerprint
 */
const getDeviceFingerprint = () => {
  try {
    const existing = localStorage.getItem(DEVICE_FINGERPRINT_KEY);
    if (existing) return existing;
    const fp = generateFingerprint();
    localStorage.setItem(DEVICE_FINGERPRINT_KEY, fp);
    return fp;
  } catch {
    return generateFingerprint();
  }
};

/**
 * Check if trial was used on this device (local check)
 */
export const wasTrialUsedLocally = () => {
  try {
    const used = localStorage.getItem(TRIAL_USED_KEY);
    return used === "true";
  } catch {
    return false;
  }
};

/**
 * Mark trial as used locally (prevents reactivation)
 */
export const markTrialUsedLocally = () => {
  try {
    localStorage.setItem(TRIAL_USED_KEY, "true");
  } catch {
    // ignore
  }
};

const ensureUserId = () => {
  try {
    const existing = localStorage.getItem(USER_KEY);
    if (existing) return existing;
    const generated =
      typeof window !== "undefined" && window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : `user-${Date.now()}`;
    localStorage.setItem(USER_KEY, generated);
    return generated;
  } catch {
    return "local-device";
  }
};

const readLocal = () => {
  try {
    const raw = localStorage.getItem(TRIAL_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const writeLocal = (state) => {
  try {
    localStorage.setItem(TRIAL_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
};

export async function loadTrialState() {
  const fallback = readLocal();
  if (!firestore) return { ...fallback, trialUsedLocally: wasTrialUsedLocally() };

  try {
    const uid = ensureUserId();
    const fp = getDeviceFingerprint();
    const ref = doc(firestore, "trials", uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      const merged = {
        plan: data.plan ?? fallback.plan ?? "trial",
        trialStartedAt: data.trialStartedAt ?? fallback.trialStartedAt,
        trialUsed: Boolean(data.trialUsed || data.trialStartedAt || wasTrialUsedLocally()),
        deviceFingerprint: data.deviceFingerprint ?? fp,
      };
      writeLocal(merged);
      // If trial was started, mark it locally too
      if (merged.trialStartedAt) {
        markTrialUsedLocally();
      }
      return merged;
    }
    return { ...fallback, trialUsedLocally: wasTrialUsedLocally() };
  } catch (error) {
    console.warn("Failed to load trial state from Firebase, using local", error);
    return { ...fallback, trialUsedLocally: wasTrialUsedLocally() };
  }
}

export async function saveTrialState(state) {
  writeLocal(state);
  // If trial is being started, mark it locally
  if (state.trialStartedAt) {
    markTrialUsedLocally();
  }
  if (!firestore) return;
  try {
    const uid = ensureUserId();
    const fp = getDeviceFingerprint();
    const ref = doc(firestore, "trials", uid);
    await setDoc(ref, { ...state, deviceFingerprint: fp, trialUsed: Boolean(state.trialStartedAt) }, { merge: true });
  } catch (error) {
    console.warn("Failed to persist trial state to Firebase", error);
  }
}

/**
 * Check if trial can be started (not already used)
 */
export async function canStartTrial() {
  // First check local flag
  if (wasTrialUsedLocally()) {
    return { canStart: false, reason: "TRIAL_USED_LOCALLY" };
  }
  
  // Then check Firebase if available
  const state = await loadTrialState();
  if (state.trialStartedAt || state.trialUsed) {
    return { canStart: false, reason: "TRIAL_ALREADY_USED" };
  }
  
  return { canStart: true };
}
