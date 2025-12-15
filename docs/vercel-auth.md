# Vercel Authentication Blocking API Calls

## Issue Summary
- In production, calling `/api/price`, `/api/ohlc`, or `/api/etf/*` returns an HTML page titled **“Authentication Required / Vercel Authentication”** instead of JSON.
- This is **not** an application bug in `api/price.ts`, `api/ohlc.ts`, or `api/etf/*`. The requests never reach the handlers because **Vercel Deployment Protection / Authentication is enabled** on the project or domain.

## Fix in Vercel Dashboard (no code change needed)
1) Open https://vercel.com and log in.  
2) Select the project **visionaimind**.  
3) Go to **Settings → Security** (or **Deployment Protection / Authentication** depending on UI).  
4) For **Production** (and Preview if desired), set **Authentication** to **Public/Disabled** so no password/SSO is required for the project domains.  
5) Save changes.  

Optional: If you want only the frontend protected but keep APIs public, protect just the frontend routes or use a separate domain for private deployments.

## How to Test After Disabling Protection
Use an incognito browser or a terminal without prior auth cookies:

PowerShell:
```powershell
$base = "https://visionaimind-b6w1ksr3l-achilles2121s-projects.vercel.app"
Invoke-RestMethod "$base/api/health" | ConvertTo-Json -Depth 6
Invoke-RestMethod "$base/api/price?asset=BTCUSD" | ConvertTo-Json -Depth 6
Invoke-RestMethod "$base/api/ohlc?asset=SPX&interval=1440&limit=60" | ConvertTo-Json -Depth 6
```
curl:
```bash
curl -L "$base/api/price?asset=BTCUSD"
```
Expected: JSON envelopes from the API, not the Vercel auth HTML page.

## Notes
- No changes to `/api` logic are required. The fix is purely in Vercel’s authentication/deployment protection settings.
- If you later re-enable protection, remember to add bypass tokens or limit protection to non-API routes.
