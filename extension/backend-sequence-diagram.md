# Backend Sequence Diagram: Successful SOVR Payment

This document outlines the sequence of events within the Secure Backend Service for a successful SOVR payment transaction initiated via the `POST /payments` endpoint.

**Actors:**

*   **Client:** The user's Chrome Extension (`background.js`).
*   **API Gateway:** The entry point for all backend requests.
*   **Payment Orchestrator:** The core service that manages the payment lifecycle.
*   **Auth Service:** The service responsible for validating JWTs and user permissions.
*   **TigerBeetle:** The distributed financial accounting database (our internal ledger).
*   **Web3 Gateway:** The service responsible for all blockchain interactions.
*   **Smart Contract:** The on-chain SOVR payment contract.
*   **Notification Service:** The service for sending asynchronous updates (WebSockets, Webhooks).

---

## Sequence of Events

1.  **Request Ingress:**
    *   The **Client** sends a `POST /payments` request with a valid JWT and an Idempotency-Key.
    *   The **API Gateway** receives the request, validates the JWT signature with the **Auth Service**, and forwards it to the **Payment Orchestrator**.

2.  **Initial Validation & Ledger Preparation:**
    *   The **Payment Orchestrator** validates the request body against the API contract.
    *   It checks the `Idempotency-Key`. If the key has been seen before, it returns the stored response for that key.
    *   It calls the **Auth Service** to verify that the user (from the JWT) is authorized to use the specified `userWalletAddress`.
    *   The **Payment Orchestrator** creates a new two-phase transfer in **TigerBeetle** with a `pending` flag. This atomically reserves the funds in the user's internal account, preventing double-spending.
        *   `Debit`: User's SOVR account (pending)
        *   `Credit`: Merchant's SOVR account (pending)
    *   If the user's balance is insufficient, TigerBeetle rejects the transfer, and the Orchestrator returns a `400 Bad Request` with an "Insufficient funds" error.

3.  **Blockchain Interaction (Web3 Gateway):**
    *   The **Payment Orchestrator** instructs the **Web3 Gateway** to execute the payment on-chain, passing the amount, user wallet, and merchant wallet details.
    *   The **Web3 Gateway** securely loads the necessary private key (e.g., a service wallet key for `burnForPOS` or an approval key).
    *   The **Web3 Gateway** crafts and signs a transaction to call the `approveAndBurn` (or similar) function on the **Smart Contract**.
    *   The **Web3 Gateway** broadcasts the transaction to the blockchain and immediately returns the `transactionHash` to the **Payment Orchestrator**.

4.  **Client Acknowledgment:**
    *   The **Payment Orchestrator** now has confirmation that the transaction has been submitted to the blockchain.
    *   It returns a `200 OK` response to the **Client** with the `transactionId` (our internal ID) and the `receipt.blockExplorerUrl` containing the `transactionHash`.
    *   The client-side flow is now complete from the user's perspective. The rest of the process is asynchronous.

5.  **Asynchronous Confirmation & Settlement:**
    *   The **Web3 Gateway** continuously monitors the blockchain for the confirmation of the transaction associated with the `transactionHash`.
    *   Once the transaction is confirmed (e.g., after a sufficient number of block confirmations), the **Web3 Gateway** publishes a `TransactionSucceeded` event to the event bus (e.g., Kafka).
    *   The **Payment Orchestrator** consumes this event.
    *   The **Payment Orchestrator** executes the second phase of the **TigerBeetle** transfer, changing the status from `pending` to `committed`. The funds are now officially settled in the merchant's internal account.

6.  **Final Notifications:**
    *   The **Payment Orchestrator** publishes a `PaymentCompleted` event to the event bus.
    *   The **Notification Service** consumes this event and performs two actions:
        *   It sends a `paymentStatusUpdate` message via the authenticated **WebSocket** to the **Client**, confirming the final success.
        *   It sends a secure **Webhook** to the merchant's registered endpoint, notifying them of the completed payment so they can fulfill the order.

---

### Failure Scenario (e.g., Blockchain Transaction Reverts)

*   If the **Web3 Gateway** detects that the on-chain transaction has failed (reverted), it publishes a `TransactionFailed` event.
*   The **Payment Orchestrator** consumes this event and aborts the **TigerBeetle** transfer, releasing the pending funds back to the user's account.
*   The **Notification Service** is triggered to inform both the user (via WebSocket) and the merchant (via Webhook) of the payment failure.