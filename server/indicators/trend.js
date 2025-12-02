export function trendStrength(emaFast, emaSlow) {
  const lastFast = emaFast?.[emaFast.length - 1] ?? 0;
  const lastSlow = emaSlow?.[emaSlow.length - 1] ?? 0;
  return lastFast - lastSlow;
}
