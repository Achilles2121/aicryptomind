const trimSlashes = (value: string) => value.replace(/\/+$/, "");

const baseUrl = trimSlashes(import.meta.env.VITE_API_BASE_URL || "");

export const apiUrl = (path: string) => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return baseUrl ? `${baseUrl}${normalized}` : normalized;
};
