# Smart Contract Interface: SOVR Point-of-Sale (POS)

This document defines the public interface for the SOVR POS smart contract. This contract is responsible for facilitating secure, on-chain payments from user wallets to merchant wallets, orchestrated by our secure backend.

**Inherits from:** OpenZeppelin's `Ownable`, `Pausable`, and `ERC20`.

---

## State Variables

```solidity
// Mapping from a merchant's internal ID (e.g., a hash) to their designated receiving wallet address.
mapping(bytes32 => address) public merchantWallets;

// Mapping to track nonces for approveAndBurn to prevent replay attacks.
mapping(address => uint256) public nonces;
```

---

## Functions

### `setMerchantWallet(bytes32 merchantId, address wallet)`

*   **Description:** Associates a merchant's unique ID with their wallet address.
*   **Access Control:** `onlyOwner` - Can only be called by the contract owner (our platform).
*   **Emits:** `MerchantWalletUpdated(merchantId, wallet)`

### `approveAndBurn(address user, address spender, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s)`

*   **Description:** Allows a user to approve our backend `spender` to burn a specific `amount` of their SOVR tokens in a single, gasless (for the user) transaction. This uses an EIP-712 signature provided by the user.
*   **Details:** The user signs an approval message off-chain. The backend (the `spender`) submits this signature to the contract, which verifies it, executes the `approve`, and then immediately calls `burnFrom`.
*   **Access Control:** Public, but requires a valid EIP-712 signature from the `user`.
*   **Emits:** `PaymentBurned(user, merchantId, amount)`

### `burnForPOS(address from, bytes32 merchantId, uint256 amount)`

*   **Description:** Allows a pre-approved backend relayer to burn SOVR tokens from a user's wallet and credit a merchant. This is used when the user has already given our backend a standard `ERC20.approve()` allowance.
*   **Details:** This is a more traditional flow where the user's `allowance` for our relayer address is checked before `burnFrom` is called.
*   **Access Control:** Must be restricted to a specific, authorized relayer address via an `onlyRelayer` modifier.
    ```solidity
    // Example Implementation:
    // address public relayerAddress;
    //
    // modifier onlyRelayer() {
    //     require(msg.sender == relayerAddress, "Caller is not the authorized relayer");
    //     _;
    // }
    ```
*   **Emits:** `PaymentBurned(from, merchantId, amount)`

### `pause()` / `unpause()`

*   **Description:** Standard pausable functions to halt all payment functions in case of an emergency.
*   **Access Control:** `onlyOwner`

---

## Events

### `event MerchantWalletUpdated(bytes32 indexed merchantId, address indexed wallet)`

*   **Description:** Emitted when a merchant's receiving wallet is set or updated.

### `event PaymentBurned(address indexed user, bytes32 indexed merchantId, uint256 amount)`

*   **Description:** Emitted when a payment is successfully processed on-chain. This is the primary event our Web3 Gateway will monitor to confirm transaction success.

---

## Implementation & Security Notes

*   **Replay Protection:** The `nonces` mapping is critical for preventing replay attacks on the `approveAndBurn` function and must be incremented after each successful use.
*   **Signature Verification:** The EIP-712 signature verification logic must be implemented carefully, following established best practices to prevent vulnerabilities.
*   **Error Messages:** All `require()` and `revert()` statements should include clear, descriptive error messages to aid in debugging and provide better off-chain error handling.
*   **Audits:** This contract must undergo one or more formal, independent security audits by reputable blockchain security firms before being deployed to any production environment. Continuous internal reviews and static analysis are also required.

---

This interface provides the necessary functions and events for our backend to securely manage on-chain payments while giving us the flexibility to support different user approval mechanisms (`approveAndBurn` for gasless UX, `burnForPOS` for standard allowance).