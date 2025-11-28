import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

const UserTierContext = createContext({ user: null, tier: "basic", loading: true });

const mapEmailToTier = (email) => {
  if (!email) return "basic";
  if (email.endsWith("@vision-ai.test")) return "elite";
  if (email.endsWith("@pro.test")) return "pro";
  return "basic";
};

export const UserTierProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [tier, setTier] = useState("basic");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setTier("basic");
        setLoading(false);
        return;
      }
      if (u.email === "oemeralpay@hotmail.com") {
        setTier("elite");
        setLoading(false);
        return;
      }
      try {
        const ref = doc(db, "users", u.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setTier(data?.tier || "basic");
        } else {
          const inferred = mapEmailToTier(u.email);
          await setDoc(ref, { email: u.email, tier: inferred, createdAt: serverTimestamp() }, { merge: true });
          setTier(inferred);
        }
      } catch (err) {
        console.warn("Tier fetch failed, using fallback", err);
        setTier(mapEmailToTier(u.email));
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  return <UserTierContext.Provider value={{ user, tier, loading }}>{children}</UserTierContext.Provider>;
};

export const useUserTier = () => useContext(UserTierContext);

// TODO: Payment-/Admin-System für Tier-Upgrade integrieren.
