// backend/src/services/stripe.service.ts
import Stripe from "stripe";

export const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export class StripeService {
  constructor() {}

  async createPaymentIntent(amount: number, currency: string, userId: string, metadata: any) {
    try {
      const paymentIntent = await stripeClient.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        // Merge the userId into the metadata to link the payment to the user.
        metadata: { ...metadata, userId },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: amount,
        currency: currency,
        status: paymentIntent.status,
      };
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      throw new Error(`Failed to create payment intent: ${error.message}`);
    }
  }
}
