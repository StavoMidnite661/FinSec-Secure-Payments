// backend/src/services/event-listener.service.ts
import { ethers } from "ethers";
import Stripe from "stripe";
import POSCreditTokenABI from "../../../abis/POSCreditToken.json";
import { config } from "../config";

export class EventListenerService {
  private provider: ethers.JsonRpcProvider | ethers.WebSocketProvider;
  private contract: ethers.Contract;
  private stripe: Stripe;

  constructor(stripeClient: Stripe) {
    this.stripe = stripeClient;

    // For testing purposes, make blockchain connection optional
    if (!config.rpcUrl || config.rpcUrl.includes('your-rpc-url-here')) {
      console.log("⚠️  No valid RPC URL provided - blockchain features disabled for testing");
      this.provider = null as any;
      this.contract = null as any;
      return;
    }

    try {
      if (config.rpcUrl.startsWith('wss')) {
        this.provider = new ethers.WebSocketProvider(config.rpcUrl);
      } else {
        this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
      }
      this.contract = new ethers.Contract(
        config.sovrTokenAddress,
        POSCreditTokenABI.abi,
        this.provider
      );
    } catch (error) {
      console.error("Failed to initialize blockchain provider:", error instanceof Error ? error.message : String(error));
      // Set to null to indicate blockchain is not available
      this.provider = null as any;
      this.contract = null as any;
    }
  }

  async start() {
    console.log("Starting event listener polling...");

    // Check if blockchain provider is available
    if (!this.provider || !this.contract) {
      console.log("⚠️  Blockchain provider not available - skipping event listener setup");
      console.log("✅ Backend API will still function for Stripe payment processing");
      return;
    }

    try {
      let lastBlock = await this.provider.getBlockNumber();
      console.log(`Connected to blockchain. Starting from block ${lastBlock}`);

      setInterval(async () => {
        try {
          const currentBlock = await this.provider.getBlockNumber();
          if (currentBlock <= lastBlock) {
            return; // No new blocks
          }

          const events = await this.contract.queryFilter(
            "TokensBurned",
            lastBlock + 1,
            currentBlock
          );

          for (const event of events) {
            // Type guard to ensure we have an EventLog with args
            if ("args" in event && event.args) {
              const [payer, amount, retailerId, transactionReference, compliancePayloadHash] = event.args;
              const formattedAmount = ethers.formatUnits(amount, 18);
              console.log(`Burned: ${formattedAmount} from ${payer} for retailer: ${retailerId}`);
              // We need a way to map the blockchain address 'payer' to a Stripe customer ID.
              // For this example, we'll assume the customer ID is stored in the payment_intent metadata.
              // In a real application, you would look up the customer ID from your database using the payer address.
              const customerId = compliancePayloadHash; // Assuming complianceHash holds the customer ID for this test.
              await this.handleStripeCredit(formattedAmount, customerId);
            }
          }

          lastBlock = currentBlock;
        } catch (error) {
          console.error("Error polling for events:", error instanceof Error ? error.message : String(error));
          // Don't crash the entire server on RPC errors during testing
        }
      }, 15000); // Poll every 15 seconds
    } catch (error: any) {
      console.error("Failed to connect to blockchain RPC:", error.message);
      console.log("⚠️  Continuing without blockchain event listener for testing purposes...");
      console.log("✅ Backend API will still function for Stripe payment processing");
      // Don't crash the server - allow it to run for testing even without blockchain connectivity
    }
  }

  private async handleStripeCredit(amount: string, payerAddress: string) {
    try {
      // Convert to cents (Stripe uses base units)
      const amountInCents = Math.floor(parseFloat(amount) * 100);

      // 1. Find customer by blockchainAddress metadata
      let customers = await this.stripe.customers.search({
        query: `metadata[\'blockchainAddress\']:\'${payerAddress}\'`,
      });
      let customer = customers.data[0];

      // 2. If no customer is found, we cannot proceed
      if (!customer) {
        console.error(`No Stripe customer found for blockchain address ${payerAddress}`);
        return;
      }

      // 3. Create a credit transaction on the customer's balance
      const creditTransaction = await this.stripe.customers.createBalanceTransaction(
        customer.id,
        {
          amount: -amountInCents, // Negative amount for a credit
          currency: "usd",
          description: "Credit for SOVR token burn",
        }
      );

      console.log("Stripe customer credit created:", creditTransaction.id);
    } catch (err: any) {
      console.error("Stripe customer credit failed:", err.message);
    }
  }
}
