import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

const UserTierContext = createContext();

export const UserTierProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [tier, setTier] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setTier("basic");
        setLoading(false);
        return;
      }

      setUser(firebaseUser);

      if (firebaseUser.email === "oemeralpay@hotmail.com") {
        setTier("elite");
        setLoading(false);
        return;
      }

      try {
        const ref = doc(db, "userTiers", firebaseUser.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setTier(snap.data().tier || "basic");
        } else {
          setTier("basic");
        }
      } catch (e) {
        console.error("Tier load error", e);
        setTier("basic");
      }

      setLoading(false);
    });

    return () => unsub();
  }, []);

  return <UserTierContext.Provider value={{ user, tier, loading }}>{children}</UserTierContext.Provider>;
};

export const useUserTier = () => useContext(UserTierContext);
