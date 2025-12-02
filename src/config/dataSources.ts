type EnvBool = string | boolean | undefined | null;

const parseEnvBool = (value: EnvBool, fallback = true) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const normalized = value.toString().trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

export type DataSourceKey =
  | "coingecko"
  | "cryptocompare"
  | "glassnode"
  | "santiment"
  | "huggingface"
  | "fmp"
  | "sosovalue"
  | "coinstats"
  | "binance"
  | "kraken"
  | "coinapi"
  | "firebase";

export type DataSourceStatus = "ok" | "warn" | "error" | "disabled" | "cors" | "degraded" | "fallback";

export type DataSourceConfig = {
  key: DataSourceKey;
  label: string;
  description: string;
  enabled: boolean;
  matchers: (string | RegExp)[];
  icon?: string;
};

const env = import.meta.env;

const CONFIG_LIST: DataSourceConfig[] = [
  {
    key: "coingecko",
    label: "CoinGecko",
    description: "Spot crypto pricing & market data",
    enabled: parseEnvBool(env?.VITE_ENABLE_COINGECKO, true),
    matchers: ["api.coingecko.com"],
  },
  {
    key: "cryptocompare",
    label: "CryptoCompare",
    description: "Spot pricing fallback",
    enabled: parseEnvBool(env?.VITE_ENABLE_CRYPTOCOMPARE, true),
    matchers: ["min-api.cryptocompare.com"],
  },
  {
    key: "glassnode",
    label: "Glassnode",
    description: "On-chain metrics",
    enabled: parseEnvBool(env?.VITE_ENABLE_GLASSNODE, true),
    matchers: ["api.glassnode.com"],
  },
  {
    key: "santiment",
    label: "Santiment",
    description: "Social / on-chain sentiment",
    enabled: parseEnvBool(env?.VITE_ENABLE_SANTIMENT, true),
    matchers: ["cryptocompare.com", "santiment"],
  },
  {
    key: "huggingface",
    label: "HuggingFace",
    description: "AI/LLM inference endpoints",
    enabled: parseEnvBool(env?.VITE_ENABLE_HUGGINGFACE, true),
    matchers: ["api-inference.huggingface.co", "huggingface.co"],
  },
  {
    key: "fmp",
    label: "FMP",
    description: "Financial Modeling Prep",
    enabled: parseEnvBool(env?.VITE_ENABLE_FMP, true),
    matchers: ["financialmodelingprep.com"],
  },
  {
    key: "sosovalue",
    label: "SosoValue",
    description: "ETF & flows data",
    enabled: parseEnvBool(env?.VITE_ENABLE_SOSOVALUE, true),
    matchers: ["sosovalue.com"],
  },
  {
    key: "coinstats",
    label: "CoinStats",
    description: "ETF news & flows",
    enabled: parseEnvBool(env?.VITE_ENABLE_COINSTATS, true),
    matchers: ["api.coinstats.app"],
  },
  {
    key: "binance",
    label: "Binance",
    description: "Funding rates",
    enabled: parseEnvBool(env?.VITE_ENABLE_BINANCE, true),
    matchers: ["fapi.binance.com"],
  },
  {
    key: "kraken",
    label: "Kraken",
    description: "Spot OHLC",
    enabled: parseEnvBool(env?.VITE_ENABLE_KRAKEN, true),
    matchers: ["api.kraken.com"],
  },
  {
    key: "coinapi",
    label: "CoinAPI",
    description: "Fallback OHLC, derivatives",
    enabled: parseEnvBool(env?.VITE_ENABLE_COINAPI, true),
    matchers: ["rest.coinapi.io"],
  },
  {
    key: "firebase",
    label: "Firebase",
    description: "User tiers",
    enabled: true,
    matchers: [],
  },
];

const CONFIG_MAP: Record<DataSourceKey, DataSourceConfig> = CONFIG_LIST.reduce((acc, cfg) => {
  acc[cfg.key] = cfg;
  return acc;
}, {} as Record<DataSourceKey, DataSourceConfig>);

export const dataSources = CONFIG_MAP;

export const isSourceEnabled = (key: DataSourceKey) => CONFIG_MAP[key]?.enabled !== false;

export const identifySource = (url?: string | RequestInfo): DataSourceKey | null => {
  if (!url) return null;
  const target = typeof url === "string" ? url : typeof url === "object" && "url" in url ? (url as any).url : String(url);
  return (
    CONFIG_LIST.find((cfg) => cfg.matchers.some((m) => (m instanceof RegExp ? m.test(target) : target.includes(m))))?.key || null
  );
};

export const listEnabledSources = () => CONFIG_LIST.filter((cfg) => cfg.enabled !== false);

export const DISABLED_RESPONSE = { status: 503, code: "DISABLED_SOURCE" } as const;