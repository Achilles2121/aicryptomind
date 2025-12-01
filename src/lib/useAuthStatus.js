import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, fetchUserTier, setCachedUserTier } from "../firebase";

export const useAuthStatus = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState("basic");

  useEffect(() => {
    if (!auth) {
      setUser(null);
      setTier("basic");
      setCachedUserTier("basic");
      setLoading(false);
      return undefined;
    }
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const t = await fetchUserTier(u.uid);
          setTier(t);
          setCachedUserTier(t);
        } catch {
          setTier("basic");
          setCachedUserTier("basic");
        }
      } else {
        setTier("basic");
        setCachedUserTier("basic");
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { user, loading, tier };
};

export default useAuthStatus;
