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
  premium?: boolean;
  requiredKeys?: string[];
};

export type MarketDataProviderType = "spot" | "derivatives" | "etf" | "onchain";

export type MarketDataProviderConfig = {
  id: string;
  label: string;
  type: MarketDataProviderType;
  baseUrl: string;
  enabledEnvFlag?: string;
  apiKeyEnv?: string;
  weight?: number;
};

const env = import.meta.env;

const CONFIG_LIST: DataSourceConfig[] = [
  {
    key: "coingecko",
    label: "CoinGecko",
    description: "Spot crypto pricing & market data",
    enabled: parseEnvBool(env?.VITE_ENABLE_COINGECKO, true),
    matchers: ["api.coingecko.com"],
    premium: false,
  },
  {
    key: "cryptocompare",
    label: "CryptoCompare",
    description: "Spot pricing fallback",
    enabled: parseEnvBool(env?.VITE_ENABLE_CRYPTOCOMPARE, true),
    matchers: ["min-api.cryptocompare.com"],
    premium: false,
  },
  {
    key: "glassnode",
    label: "Glassnode",
    description: "On-chain metrics",
    enabled: parseEnvBool(env?.VITE_ENABLE_GLASSNODE, true),
    matchers: ["api.glassnode.com"],
    premium: true,
    requiredKeys: ["VITE_GLASSNODE_KEY", "GLASSNODE_API_KEY"],
  },
  {
    key: "santiment",
    label: "Santiment",
    description: "Social / on-chain sentiment",
    enabled: parseEnvBool(env?.VITE_ENABLE_SANTIMENT, true),
    matchers: ["cryptocompare.com", "santiment"],
    premium: true,
    requiredKeys: ["VITE_SANTIMENT_KEY", "SANTIMENT_KEY"],
  },
  {
    key: "huggingface",
    label: "HuggingFace",
    description: "AI/LLM inference endpoints",
    enabled: parseEnvBool(env?.VITE_ENABLE_HUGGINGFACE, true),
    matchers: ["api-inference.huggingface.co", "huggingface.co"],
    premium: true,
    requiredKeys: ["VITE_HUGGINGFACE_KEY", "HUGGINGFACE_API_KEY"],
  },
  {
    key: "fmp",
    label: "FMP",
    description: "Financial Modeling Prep",
    enabled: parseEnvBool(env?.VITE_ENABLE_FMP, true),
    matchers: ["financialmodelingprep.com"],
    premium: true,
    requiredKeys: ["VITE_FMP_KEY", "FMP_API_KEY", "FMP_KEY"],
  },
  {
    key: "sosovalue",
    label: "SosoValue",
    description: "ETF & flows data",
    enabled: parseEnvBool(env?.VITE_ENABLE_SOSOVALUE, true),
    matchers: ["sosovalue.com"],
    premium: false,
  },
  {
    key: "coinstats",
    label: "CoinStats",
    description: "ETF news & flows",
    enabled: parseEnvBool(env?.VITE_ENABLE_COINSTATS, true),
    matchers: ["api.coinstats.app"],
    premium: false,
  },
  {
    key: "binance",
    label: "Binance",
    description: "Funding rates",
    enabled: parseEnvBool(env?.VITE_ENABLE_BINANCE, true),
    matchers: ["fapi.binance.com"],
    premium: false,
  },
  {
    key: "kraken",
    label: "Kraken",
    description: "Spot OHLC",
    enabled: parseEnvBool(env?.VITE_ENABLE_KRAKEN, true),
    matchers: ["api.kraken.com"],
    premium: false,
  },
  {
    key: "coinapi",
    label: "CoinAPI",
    description: "Fallback OHLC, derivatives",
    enabled: parseEnvBool(env?.VITE_ENABLE_COINAPI, true),
    matchers: ["rest.coinapi.io"],
    premium: true,
    requiredKeys: ["VITE_COINAPI_KEY", "COINAPI_KEY"],
  },
  {
    key: "firebase",
    label: "Firebase",
    description: "User tiers",
    enabled: true,
    matchers: [],
    premium: false,
  },
];

const CONFIG_MAP: Record<DataSourceKey, DataSourceConfig> = CONFIG_LIST.reduce((acc, cfg) => {
  acc[cfg.key] = cfg;
  return acc;
}, {} as Record<DataSourceKey, DataSourceConfig>);

const isProviderFlagEnabled = (flag?: string) => {
  if (!flag) return true;
  return parseEnvBool(env?.[flag as keyof typeof env], false) === true;
};

export const MARKET_DATA_PROVIDERS: MarketDataProviderConfig[] = [
  {
    id: "coingecko",
    label: "CoinGecko",
    type: "spot",
    baseUrl: "https://api.coingecko.com/api/v3",
    enabledEnvFlag: "VITE_ENABLE_COINGECKO",
    weight: 1,
  },
  {
    id: "binance",
    label: "Binance",
    type: "spot",
    baseUrl: "https://api.binance.com/api/v3",
    enabledEnvFlag: "VITE_ENABLE_BINANCE",
    weight: 0.9,
  },
  {
    id: "STOOQ",
    label: "Stooq (Index/FX)",
    type: "spot",
    baseUrl: "https://stooq.pl",
    weight: 0.82,
  },
  {
    id: "FX_PROVIDER",
    label: "FX Provider (Open)",
    type: "spot",
    baseUrl: "https://stooq.pl",
    weight: 0.81,
  },
  {
    id: "kraken",
    label: "Kraken",
    type: "spot",
    baseUrl: "https://api.kraken.com/0",
    enabledEnvFlag: "VITE_ENABLE_KRAKEN",
    weight: 0.85,
  },
  {
    id: "coinapi",
    label: "CoinAPI",
    type: "derivatives",
    baseUrl: "https://rest.coinapi.io/v1",
    enabledEnvFlag: "VITE_ENABLE_COINAPI",
    apiKeyEnv: "VITE_COINAPI_KEY",
    weight: 0.8,
  },
  {
    id: "coinstats",
    label: "CoinStats",
    type: "etf",
    baseUrl: "https://api.coinstats.app",
    enabledEnvFlag: "VITE_ENABLE_COINSTATS",
    weight: 0.6,
  },
  {
    id: "openprovider1",
    label: "Open Data Feed 1",
    type: "spot",
    baseUrl: "https://api.openprovider1.example",
    enabledEnvFlag: "VITE_ENABLE_OPENPROVIDER1",
    weight: 0.5,
  },
  {
    id: "openprovider2",
    label: "Open Data Feed 2",
    type: "onchain",
    baseUrl: "https://api.openprovider2.example",
    enabledEnvFlag: "VITE_ENABLE_OPENPROVIDER2",
    weight: 0.3,
  },
];

export const getActiveProviders = (type?: MarketDataProviderType) =>
  MARKET_DATA_PROVIDERS.filter((p) => isProviderFlagEnabled(p.enabledEnvFlag) && (!type || p.type === type)).sort(
    (a, b) => (b.weight ?? 0) - (a.weight ?? 0)
  );

export const dataSources = CONFIG_MAP;

export const isSourceEnabled = (key: DataSourceKey) => CONFIG_MAP[key]?.enabled !== false;

export const identifySource = (url?: string | RequestInfo): DataSourceKey | null => {
  if (!url) return null;
  let target: string;
  if (typeof url === "string") {
    target = url;
  } else if (typeof url === "object" && "url" in url) {
    target = (url as { url: string }).url;
  } else {
    target = String(url);
  }
  return (
    CONFIG_LIST.find((cfg) => cfg.matchers.some((m) => (m instanceof RegExp ? m.test(target) : target.includes(m))))?.key || null
  );
};

export const listEnabledSources = () => CONFIG_LIST.filter((cfg) => cfg.enabled !== false);

export const DISABLED_RESPONSE = { status: 503, code: "DISABLED_SOURCE" } as const;
