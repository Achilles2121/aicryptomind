import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc, getFirestore, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

export const TRIAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const initializeFirebase = () => {
  try {
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      console.error("Firebase env vars fehlen");
      return null;
    }
    if (getApps().length === 0) {
      return initializeApp(firebaseConfig);
    }
    return getApp();
  } catch (err) {
    console.error("Firebase init failed", err);
    return null;
  }
};

const app = initializeFirebase();
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

// Google Auth Provider
const googleProvider = app ? new GoogleAuthProvider() : null;
if (googleProvider) {
  googleProvider.setCustomParameters({ prompt: 'select_account' });
}

// Re-export onAuthStateChanged for convenience
export { onAuthStateChanged };

let userTierCache = "basic";

export const setCachedUserTier = (tier) => {
  userTierCache = tier || "basic";
};

export const getCachedUserTier = () => userTierCache;

export const saveUserTier = async (uid, tier = "basic", extra = {}) => {
  if (!uid || !db) return;
  try {
    await setDoc(doc(db, "userTiers", uid), { tier, ...extra }, { merge: true });
    setCachedUserTier(tier);
  } catch (err) {
    console.warn("saveUserTier failed", err);
  }
};

export const fetchUserTier = async (uid) => {
  const baseResponse = { tier: "basic", trialStart: null, trialEndsAt: null, trialUsed: false, source: "firebase" };
  if (!uid || !db) {
    setCachedUserTier("basic");
    const error = uid ? "NO_DB" : "NO_UID";
    return { ...baseResponse, error };
  }
  try {
    const ref = doc(db, "userTiers", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const now = Date.now();
      const payload = { tier: "elite_trial", trialStart: now, trialEndsAt: now + TRIAL_WINDOW_MS, trialUsed: true };
      await setDoc(ref, payload, { merge: true });
      setCachedUserTier("elite");
      return { ...payload, source: "firebase" };
    }
    const data = snap.data() || {};
    const tier = data?.tier || "basic";
    const trialStart = data?.trialStart || null;
    const trialEndsAt = data?.trialEndsAt || (trialStart ? Number(trialStart) + TRIAL_WINDOW_MS : null);
    const trialUsed = Boolean(data?.trialUsed || trialStart);
    setCachedUserTier(tier);
    return { tier, trialStart, trialEndsAt, trialUsed, source: "firebase" };
  } catch (err) {
    const code = err?.code === "permission-denied" ? "MISSING_PERMISSION" : err?.code || "UNKNOWN";
    console.warn("fetchUserTier failed", err);
    setCachedUserTier("basic");
    return { ...baseResponse, error: code };
  }
};

export const signup = async (email, password) => {
  if (!auth) throw new Error("Firebase nicht initialisiert");
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(
    doc(db, "userTiers", cred.user.uid),
    { tier: "basic", trialStart: null, trialEndsAt: null, trialUsed: false },
    { merge: true }
  );
  setCachedUserTier("basic");
  return cred;
};

export const startUserTrial = async (uid, windowMs = TRIAL_WINDOW_MS) => {
  if (!uid || !db) throw new Error("Trial start requires authenticated user");
  const ref = doc(db, "userTiers", uid);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  if (data?.trialStart) {
    const trialStart = Number(data.trialStart);
    const trialEndsAt = data?.trialEndsAt || (Number.isFinite(trialStart) ? trialStart + windowMs : null);
    return { ok: false, reason: "TRIAL_ALREADY_USED", trialStart, trialEndsAt };
  }
  const now = Date.now();
  const payload = { trialStart: now, trialEndsAt: now + windowMs, trialUsed: true };
  await setDoc(ref, payload, { merge: true });
  return { ok: true, ...payload };
};

export const login = async (email, password) => {
  if (!auth) throw new Error("Firebase nicht initialisiert");
  return signInWithEmailAndPassword(auth, email, password);
};

// Google Sign-In
export const signInWithGoogle = async () => {
  if (!auth || !googleProvider) throw new Error("Firebase nicht initialisiert");
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Check if user exists in Firestore, if not create basic account
    const ref = doc(db, "userTiers", user.uid);
    const snap = await getDoc(ref);
    
    if (!snap.exists()) {
      // New user via Google - create basic account (no auto-trial)
      await setDoc(ref, {
        tier: "basic",
        trialStart: null,
        trialEndsAt: null,
        trialUsed: false,
        provider: "google",
        email: user.email,
        createdAt: Date.now(),
      });
      setCachedUserTier("basic");
    } else {
      const data = snap.data();
      setCachedUserTier(data?.tier || "basic");
    }
    
    return result;
  } catch (err) {
    console.error("Google sign-in failed", err);
    throw err;
  }
};

// Get current user's trial data
export const getUserTrialData = async (uid) => {
  if (!uid || !db) return null;
  try {
    const ref = doc(db, "userTiers", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    
    const data = snap.data();
    return {
      trialStart: data?.trialStart ? new Date(data.trialStart).toISOString() : null,
      trialEndsAt: data?.trialEndsAt ? new Date(data.trialEndsAt).toISOString() : null,
      trialUsed: Boolean(data?.trialUsed),
    };
  } catch (err) {
    console.error("getUserTrialData failed", err);
    return null;
  }
};

export const logout = async () => {
  if (!auth) return;
  return signOut(auth);
};

export const saveWinrateSnapshot = async () => null; // placeholder
export const loadWinrateSnapshot = async () => null; // placeholder

export default app;
