// backend/src/services/payment.service.ts
import { stripeClient, StripeService } from "./stripe.service";
import { SOVRService } from "./sovr.service";

export class PaymentService {
  private sovrService!: SOVRService;
  private stripeService: StripeService;

  private constructor() {
    this.stripeService = new StripeService();
  }

  public static async create(): Promise<PaymentService> {
    const instance = new PaymentService();
    instance.sovrService = await SOVRService.create();
    return instance;
  }

  async getPayout(payoutId: string, userId: string) {
    const payout = await stripeClient.payouts.retrieve(payoutId);

    // This is a placeholder for a real authorization check.
    // Stripe Payouts do not directly contain the metadata of the PaymentIntents that they are composed of.
    // A real implementation would require a more complex lookup, potentially storing payout-to-user mappings
    // in your own database when a payout is created.
    // For now, we will throw an error to prevent insecure data access.
    throw new Error("Authorization check not implemented. Cannot securely retrieve payout.");

    // Example of a conceptual check if the data were available:
    /*
    if (payout.metadata?.userId !== userId) {
      throw new Error("Unauthorized: You do not have permission to view this payout.");
    }
    return payout;
    */
  }

  async initiatePayment(amount: number, currency: string, userId: string, metadata: any) {
    return this.stripeService.createPaymentIntent(amount, currency, userId, metadata);
  }

  async initiateSacrifice(userAddress: string, amount: string, retailerId: string, complianceHash: string) {
    try {
      const result = await this.sovrService.sacrificeSOVR(userAddress, amount, retailerId, complianceHash);
      return result;
    } catch (error) {
      console.error("Error in initiateSacrifice:", error);
      throw new Error("Failed to initiate sacrifice.");
    }
  }
}