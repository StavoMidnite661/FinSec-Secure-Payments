# FinSec Integrated (Extension + Backend)

This bundle wires your **FinSec Secure Payments** Chrome Extension to the included **Payment Processor** backend.

## TL;DR — Run it

### 1) Start the backend (port 3000)
```bash
cd backend
npm install
npm run build
npm start
# Server: http://localhost:3000
# Health:  GET /        -> "Payment Processor Template API is running!"
# Initiate:POST /api/payment/initiate
# Webhook: POST /api/payment/webhook  (Stripe raw body)
```

### 2) Load the extension
1. Open `chrome://extensions`
2. Toggle **Developer mode** (top right)
3. Click **Load unpacked** and choose: `extension/`
4. Pin **FinSec Secure Payments** and open the popup

## What changed

- **Manifest CSP** now allows `connect-src http://localhost:3000 ws://localhost:3000` so the service worker can call your API.
- **background.js** now uses `BASE_URL = "http://localhost:3000"` and calls `POST /api/payment/initiate`.
- **Logout** server call is stubbed (no backend route required). You can implement one later if needed.
- **Host permissions** now include `http://localhost:3000/*` for future content-script needs.

## Endpoints (backend)
- `GET /` — health
- `POST /api/payment/initiate` — starts a payment (see `src/controllers/payment.controller.ts`)
- `POST /api/payment/webhook` — Stripe webhook (expects raw body; set your `STRIPE_WEBHOOK_SECRET`)

## Config
- Backend uses `PORT=3000` by default. Change `.env` and update `BASE_URL` in `extension/background.js` if you switch ports.
- The extension uses `chrome.identity` OAuth. If you don't need Google sign-in, you can disable login UI in `popup/popup.js` and replace token usage on the backend.

## Notes
- If Chrome complains about the service worker, click **Service Worker** under the extension to view logs.
- For real Stripe, set secrets in `backend/.env` (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, etc.).
