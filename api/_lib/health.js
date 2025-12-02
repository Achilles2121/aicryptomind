export const createHealthTracker = () => {
  const entries = new Map();
  return {
    set(key, status, message = "") {
      entries.set(key, {
        key,
        status,
        message,
        ts: new Date().toISOString(),
      });
    },
    toArray() {
      return Array.from(entries.values());
    },
  };
};
