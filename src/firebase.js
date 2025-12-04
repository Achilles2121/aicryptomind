import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  signInAnonymously,
} from "firebase/auth";
import { doc, getDoc, getFirestore, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";

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
    const snap = await getDoc(doc(db, "userTiers", uid));
    const data = snap.exists() ? snap.data() : {};
    const tier = data?.tier || "basic";
    const trialStart =
      data?.trialStart instanceof Timestamp ? data.trialStart.toMillis() : Number(data?.trialStart) || null;
    const trialEndsAtRaw =
      data?.trialEndsAt instanceof Timestamp ? data.trialEndsAt.toMillis() : Number(data?.trialEndsAt) || null;
    const trialEndsAt = trialEndsAtRaw || (trialStart ? trialStart + TRIAL_WINDOW_MS : null);
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

export const ensureUserOrAnonymous = async () => {
  if (!auth) throw new Error("Firebase nicht initialisiert");
  if (auth.currentUser) return auth.currentUser;
  const cred = await signInAnonymously(auth);
  return cred.user;
};

export const startUserTrial = async (uid, windowMs = TRIAL_WINDOW_MS) => {
  if (!db) return { ok: false, reason: "NO_DB" };
  let user = null;
  try {
    user = await ensureUserOrAnonymous();
  } catch (err) {
    return { ok: false, reason: err?.code || "NO_AUTH", message: err?.message };
  }
  const effectiveUid = uid || user?.uid;
  if (!effectiveUid) return { ok: false, reason: "NO_UID" };
  const ref = doc(db, "userTiers", effectiveUid);
  try {
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};
    if (data?.trialStart) {
      const trialStart = data.trialStart instanceof Timestamp ? data.trialStart.toMillis() : Number(data.trialStart);
      const trialEndsAtRaw =
        data.trialEndsAt instanceof Timestamp ? data.trialEndsAt.toMillis() : Number(data.trialEndsAt);
      const trialEndsAt = trialEndsAtRaw || (Number.isFinite(trialStart) ? trialStart + windowMs : null);
      return { ok: false, reason: "TRIAL_ALREADY_USED", trialStart, trialEndsAt };
    }
    const nowTs = Timestamp.now();
    const payload = {
      tier: "trial",
      trialStart: serverTimestamp(),
      trialEndsAt: nowTs.toMillis() + windowMs,
      trialUsed: true,
    };
    await setDoc(ref, payload, { merge: true });
    const fresh = await getDoc(ref);
    const stored = fresh.exists() ? fresh.data() : {};
    const trialStart =
      stored.trialStart instanceof Timestamp ? stored.trialStart.toMillis() : Number(stored.trialStart) || nowTs.toMillis();
    const trialEndsAt =
      stored.trialEndsAt instanceof Timestamp ? stored.trialEndsAt.toMillis() : Number(stored.trialEndsAt) || payload.trialEndsAt;
    return { ok: true, trialStart, trialEndsAt, tier: stored.tier || "trial" };
  } catch (err) {
    console.warn("startUserTrial failed", err);
    return { ok: false, reason: err?.code || "TRIAL_START_FAILED", message: err?.message };
  }
};

export const login = async (email, password) => {
  if (!auth) throw new Error("Firebase nicht initialisiert");
  return signInWithEmailAndPassword(auth, email, password);
};

export const logout = async () => {
  if (!auth) return;
  return signOut(auth);
};

export const saveWinrateSnapshot = async () => null; // placeholder
export const loadWinrateSnapshot = async () => null; // placeholder

export default app;
