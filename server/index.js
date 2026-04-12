/* eslint-env node */
import express from "express";
import cors from "cors";
import morgan from "morgan";
import priceRouter from "./routes/price.js";
import binanceRouter from "./routes/binance.js";
import krakenRouter from "./routes/kraken.js";
import ohlcRouter from "./routes/ohlc.js";
import coinsRouter from "./routes/coins.js";
import sentimentRouter from "./routes/sentiment.js";
import etfNewsRouter from "./routes/etfNews.js";
import etfFlowsRouter from "./routes/etfFlows.js";
import etfHoldingsRouter from "./routes/etfHoldings.js";
import etfCorrelationsRouter from "./routes/etfCorrelations.js";
import indicatorsRouter from "./routes/indicators.js";
import derivativesRouter from "./routes/derivatives.js";
import healthRouter from "./routes/health.js";
import signalRouter from "./routes/signal.js";
import { rateLimit } from "./utils/rateLimit.js";

const app = express();
const PORT = process.env.PORT || 5176;

app.use(cors({ origin: true }));
app.use(express.json());
app.use(morgan("dev"));
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 240,
  })
);

app.use("/api/price", priceRouter);
app.use("/api/binance", binanceRouter);
app.use("/api/kraken", krakenRouter);
app.use("/api/ohlc", ohlcRouter);
app.use("/api/coins", coinsRouter);
app.use("/api/sentiment", sentimentRouter);
app.use("/api/etf/news", etfNewsRouter);
app.use("/api/etf/flows", etfFlowsRouter);
app.use("/api/etf/holdings", etfHoldingsRouter);
app.use("/api/etf/correlations", etfCorrelationsRouter);
app.use("/api/indicators", indicatorsRouter);
app.use("/api/derivatives", derivativesRouter);
app.use("/api/signal", signalRouter);
app.use("/api/health", healthRouter);

app.use((err, _req, res, _next) => {
  console.error("[SERVER ERROR]", err);
  if (res.headersSent) return;
  res.status(err?.status || 500).json({ error: "internal_server_error", message: err?.message || "Unknown error" });
});

app.listen(PORT, () => {
  console.log(`Proxy server listening on http://localhost:${PORT}`);
});
