import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc, getFirestore, setDoc } from "firebase/firestore";
// import { getStorage } from "firebase/storage"; // falls benötigt
// import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

export const initializeFirebase = () => {
  try {
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      console.error("Firebase env vars fehlen");
      return null;
    }
    return !getApps().length ? initializeApp(firebaseConfig) : getApp();
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

export const saveUserTier = async (uid, tier = "basic") => {
  if (!uid) return;
  await setDoc(doc(db, "userTiers", uid), { tier }, { merge: true });
  setCachedUserTier(tier);
};

export const fetchUserTier = async (uid) => {
  if (!uid) return "basic";
  const snap = await getDoc(doc(db, "userTiers", uid));
  const tier = snap.exists() ? snap.data()?.tier || "basic" : "basic";
  setCachedUserTier(tier);
  return tier;
};

export const signup = async (email, password) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await saveUserTier(cred.user.uid, "basic");
  return cred;
};

export const login = async (email, password) => signInWithEmailAndPassword(auth, email, password);
export const logout = async () => signOut(auth);

export const saveWinrateSnapshot = async () => Promise.resolve(null); // placeholder
export const loadWinrateSnapshot = async () => Promise.resolve(null); // placeholder

export default app;
