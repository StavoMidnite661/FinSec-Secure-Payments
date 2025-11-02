// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title SOVRCreditBridgePOS
 * @author FinSec Architect Team
 * @notice This contract facilitates secure, on-chain point-of-sale (POS) payments
 * using SOVR tokens. The token is designed to represent purchasing power, with an
 * intended economic value where it functions as a US-denominated credit system
 * (e.g., where a certain number of tokens correspond to 1 USD).
 * It allows for both gasless (meta-transaction) and standard allowance-based
 * payment flows, orchestrated by a secure backend relayer.
 */
contract SOVRCreditBridgePOS is ERC20, Ownable, Pausable, ERC20Permit {

    // --- State Variables ---

    /// @notice The maximum total supply of SOVR tokens.
    uint256 public constant MAX_SUPPLY = 250000 * 10 ** 18;
    /// @notice Maps a unique merchant identifier to their designated payment-receiving wallet.
    mapping(bytes32 => address) public merchantWallets;
    /// @notice The trusted backend address authorized to execute relayed transactions.
    address public immutable relayerAddress;
    /// @notice EIP-712 nonce for each user to prevent replay attacks on `permit`.
    // The nonces mapping for EIP-712 replay protection is inherited from ERC20Permit.

    // --- Events ---

    /// @notice Emitted when a merchant's wallet address is set or updated by the owner.
    /// @param merchantId The unique identifier for the merchant.
    /// @param wallet The new wallet address for the merchant.
    event MerchantWalletUpdated(bytes32 indexed merchantId, address indexed wallet);
    /// @notice Emitted upon a successful payment, where tokens are burned from the user's account.
    /// @param user The user whose tokens were burned.
    /// @param merchantId The merchant who received the payment.
    /// @param amount The amount of tokens burned.
    event PaymentBurned(address indexed user, bytes32 indexed merchantId, uint256 amount);
    /// @notice Emitted when new tokens are minted.
    /// @param user The address receiving the minted tokens.
    /// @param amount The amount of tokens minted.
    event Minted(address indexed user, uint256 amount);
    /// @notice Emitted when credit is issued, typically during the initial minting process.
    /// @param user The address receiving the credit.
    /// @param amount The amount of credit issued.
    /// @param purpose A description of why the credit was issued.
    event CreditIssued(address indexed user, uint256 amount, string purpose);

    // --- Modifiers ---

    /**
     * @dev Throws if called by any account other than the authorized relayer.
     */
    modifier onlyRelayer() {
        require(msg.sender == relayerAddress, "SOVRPOS: Caller is not the authorized relayer");
        _;
    }

    // --- Constructor ---

    /**
     * @notice Constructs the SOVRCreditBridgePOS contract.
     * @param initialOwner The address that will have ownership of the contract.
     * @param _relayerAddress The address of the trusted backend relayer.
     * @param name The name of the ERC20 token.
     * @param symbol The symbol of the ERC20 token.
     */
    constructor(address initialOwner, address _relayerAddress, string memory name, string memory symbol)
        ERC20(name, symbol)
        Ownable(initialOwner)
        Pausable()
        ERC20Permit(name)
    {
        require(_relayerAddress != address(0), "SOVRPOS: Cannot set relayer to zero address");
        relayerAddress = _relayerAddress;
        _mint(initialOwner, MAX_SUPPLY);
        emit Minted(initialOwner, MAX_SUPPLY);
        emit CreditIssued(initialOwner, MAX_SUPPLY, "Initial Mint to Owner");
    }

    // --- Owner-Only Functions ---
    
    /**
     * @notice Allows the owner to withdraw tokens from the contract to any address.
     * @dev This is critical for initial distribution or if tokens are accidentally sent to the contract.
     * @param to The address to send the tokens to.
     * @param amount The amount of tokens to send.
     */
    function ownerWithdraw(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "SOVRPOS: Cannot transfer to zero address");
        _transfer(address(this), to, amount);
    }

    /**
     * @notice Sets or updates the wallet address for a given merchant ID.
     * @dev Can only be called by the contract owner.
     * @param merchantId The unique identifier for the merchant.
     * @param wallet The new wallet address for the merchant.
     */
    function setMerchantWallet(bytes32 merchantId, address wallet) external onlyOwner {
        require(wallet != address(0), "SOVRPOS: Cannot set wallet to zero address");
        merchantWallets[merchantId] = wallet;
        emit MerchantWalletUpdated(merchantId, wallet);
    }

    /**
     * @notice Pauses the contract, halting key payment functions.
     * @dev Can only be called by the contract owner. Acts as a safety mechanism.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses the contract, resuming normal operations.
     * @dev Can only be called by the contract owner.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // --- Payment Functions ---

    /**
     * @notice Processes a payment via a gasless meta-transaction using an EIP-712 signature.
     * @dev The user signs an approval (permit) off-chain, and the relayer submits it.
     * The `permit` function verifies the signature, checks and consumes the nonce, and grants
     * allowance to `msg.sender` (the relayer). The tokens are then immediately burned.
     * @param user The user making the payment.
     * @param merchantId The merchant receiving the payment.
     * @param amount The payment amount in token units.
     * @param deadline The timestamp after which the signature is invalid.
     * @param v The recovery ID of the signature.
     * @param r The r-value of the signature.
     * @param s The s-value of the signature.
     */
    function approveAndBurn(address user, bytes32 merchantId, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external whenNotPaused {
        require(merchantWallets[merchantId] != address(0), "SOVRPOS: Merchant not registered");
        
        // The permit function from OpenZeppelin's ERC20Permit internally handles nonce checking
        // and will revert if the signature's nonce does not match the contract's current nonce for the user.
        // It also automatically increments the nonce upon successful execution, preventing replay attacks.
        permit(user, msg.sender, amount, deadline, v, r, s);
        
        // After a successful permit, the allowance is set, and the nonce is consumed. We can now burn the tokens.
        _burn(user, amount);
        emit PaymentBurned(user, merchantId, amount);
    }

    /**
     * @notice Processes a payment for a user who has already granted a standard ERC20 allowance to the relayer.
     * @dev This function is called exclusively by the authorized relayer. It spends the user's
     * allowance and then burns the tokens to finalize the payment.
     * @param from The user making the payment.
     * @param merchantId The merchant receiving the payment.
     * @param amount The payment amount in token units.
     */
    function burnForPOS(address from, bytes32 merchantId, uint256 amount) external onlyRelayer whenNotPaused {
    require(merchantWallets[merchantId] != address(0), "SOVRPOS: Merchant not registered");
    _spendAllowance(from, msg.sender, amount); // Deduct allowance
    _burn(from, amount); // Burn tokens
    emit PaymentBurned(from, merchantId, amount);
}
}
