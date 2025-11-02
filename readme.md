# FinSec Integrated (Extension + Backend)

This project provides a modular backend template for processing SOVR tokens and integrating with Stripe for USD payments. It's designed to be easily adaptable and reusable for various applications that need to route payments through Stripe. This bundle wires your **FinSec Secure Payments** Chrome Extension to the included **Payment Processor** backend.

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

## Project Structure

```
payment-processor-template/
├── src/
│   ├── config/
│   │   └── index.ts             // Configuration for Stripe, SOVR contracts, etc.
│   ├── services/
│   │   ├── stripe.service.ts    // Handles all Stripe API interactions
│   │   ├── sovr.service.ts      // Handles all SOVR token interactions (e.g., burning)
│   │   └── payment.service.ts   // Orchestrates the payment workflow (SOVR -> Stripe)
│   ├── controllers/
│   │   └── payment.controller.ts // API endpoints for payment initiation and webhooks
│   ├── types/
│   │   └── index.d.ts           // TypeScript type definitions
│   └── app.ts                   // Main application entry point (e.g., Express app)
├── .env.example                 // Example environment variables
├── package.json                 // Project dependencies and scripts
├── tsconfig.json                // TypeScript configuration
├── README.md                    // Project documentation and usage instructions
```

## Setup and Installation

1.  **Clone the repository (or copy these files into your project).**
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Configure environment variables:**
    Create a `.env` file in the root directory based on `.env.example`.
    *   `STRIPE_SECRET_KEY`: Your Stripe secret key.
    *   `SOVR_CONTRACT_ADDRESS`: The address of the SOVR token smart contract.
    *   `ETHEREUM_NODE_URL`: URL of an Ethereum node (e.g., Infura, Alchemy) to interact with the SOVR contract.
    *   `PORT`: The port your server will run on (default: 3000).

## Running the Application

1.  **Build the TypeScript code:**
    ```bash
    npm run build
    ```
2.  **Start the server:**
    ```bash
    npm start
    ```

    Alternatively, for development with hot-reloading:
    ```bash
    npm run dev
    ```

## API Endpoints

(To be defined as controllers are implemented)

## How it Works

This template provides a foundation for a payment flow where:

1.  A user initiates a payment, potentially involving SOVR tokens.
2.  The `payment.service.ts` orchestrates the process, interacting with `sovr.service.ts` for any SOVR-related operations (e.g., burning SOVR).
3.  The `stripe.service.ts` handles the creation of Stripe Payment Intents and other Stripe API calls to process the USD payment.
4.  Webhooks from Stripe are handled by `payment.controller.ts` to update the payment status in your system.

## Customization

*   **SOVR Logic:** Modify `sovr.service.ts` to implement specific SOVR token interactions (e.g., different burning mechanisms, honor calculation).
*   **Stripe Integration:** Adjust `stripe.service.ts` to handle different Stripe products, subscriptions, or advanced payment methods.
*   **Payment Workflow:** Customize `payment.service.ts` to define your unique payment flow, including any business logic before or after SOVR and Stripe interactions.
*   **API Endpoints:** Extend `payment.controller.ts` to expose additional API endpoints as needed for your application.