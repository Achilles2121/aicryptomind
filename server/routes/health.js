import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.json({ ok: true, ts: Date.now() });
});

export default router;
