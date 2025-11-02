# API Contracts

This document defines the API contracts for the FinSec Secure Backend Service.

## Payment Initiation

### `POST /payments`

**Description:** Initiates a new payment transaction. The backend validates the request, interacts with the appropriate payment system (e.g., TigerBeetle, Smart Contract Gateway), and returns the initial status of the transaction.

**Headers:**

*   `Authorization`: `Bearer <JWT>` (Required) - The OAuth 2.0 access token obtained via `chrome.identity`.
*   `Content-Type`: `application/json` (Required)
*   `Idempotency-Key`: `UUID` (Optional, but highly recommended) - A unique key to prevent duplicate transaction processing on retries.

**Request Body:**

```json
{
  "amount": 123.45,
  "currency": "USD",
  "merchantName": "test-merchant.com",
  "paymentMethod": "SOVR",
  "userWalletAddress": "0x...",
  "metadata": {
    "merchantId": "MERCH_XYZ",
    "orderReference": "ORD_ABC-123"
  }
}
```

*   `amount` (number, required): The transaction amount, as a float.
*   `currency` (string, required): The ISO 4217 currency code (e.g., "USD").
*   `merchantName` (string, required): The hostname of the merchant where the transaction was initiated.
*   `paymentMethod` (string, required): The selected payment method (e.g., 'SOVR', 'CARD', 'OPEN_BANKING').

---

**Responses:**

#### `202 Accepted` (SCA / Redirect Required)

The payment requires further user interaction (e.g., wallet connection, 3D Secure). The client should use the `redirectUrl` to guide the user.

```json
{
  "status": "pending_sca",
  "message": "Please complete authentication with your wallet.",
  "transactionId": "txn_123abc456def",
  "redirectUrl": "https://wallet-connect-provider.com/auth/xyz"
}
```

#### `200 OK` (Direct Completion)

The payment was processed directly without requiring further user interaction.

```json
{
  "status": "COMPLETED",
  "message": "Payment successful.",
  "transactionId": "txn_789ghi012jkl",
  "receipt": {
    "blockExplorerUrl": "https://explorer.sovrn.com/tx/0x..."
  }
}
```

#### `400 Bad Request` / `401 Unauthorized` / `500 Internal Server Error`

Standard HTTP error responses will be returned with a JSON body detailing the error.

```json
{
  "status": "error",
  "error": "Descriptive error message here."
}
```