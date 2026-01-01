import { safeFixed } from "./safeFixed";

export const formatCurrency = (value: number, digits = 2) =>
  Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits }).format(
    value || 0
  );

export const formatNumber = (value: number, digits = 2) =>
  Number(value ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

export const formatPercent = (value: number, digits = 2) =>
  `${safeFixed(Number(value ?? 0) * 100, digits)}%`;

export const formatDate = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
