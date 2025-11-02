

import express, { Request, Response } from 'express';
import { stripeClient } from '../services/stripe.service';
import { config } from '../config';
import Stripe from 'stripe';
import { SOVRService } from '../services/sovr.service';

const router = express.Router();

router.get('/stripe', (req: Request, res: Response) => {
  res.status(200).send('Stripe webhook endpoint is listening for POST requests.');
});

router.post('/stripe', async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string;

    let event: Stripe.Event;

    try {
      event = stripeClient.webhooks.constructEvent(
        req.body,
        sig,
        config.stripeWebhookSecret
      );
    } catch (err: any) {
      console.log(`Error message: ${err.message}`);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('PaymentIntent was successful!');

        // --- Start of new business logic ---
        try {

          console.log('Initializing SOVR service to process payment...');
          const sovrService = await SOVRService.create();

          // Extract amount and assume complianceHash is in metadata
          // Stripe amounts are in the smallest currency unit (e.g., cents)
          const amountInDollars = (paymentIntent.amount / 100).toString();
          const complianceHash = paymentIntent.metadata.complianceHash;
          const retailerId = paymentIntent.metadata.retailerId || config.retailerId;

          if (!complianceHash || !retailerId) {
            console.error('Compliance hash or retailerId not found in payment metadata. Skipping SOVR sacrifice.');
          } else {
             console.log(`Attempting to sacrifice ${amountInDollars} SOVR with retailerId: ${retailerId} and hash: ${complianceHash}`);
             const result = await sovrService.sacrificeSOVR(amountInDollars, retailerId, complianceHash);
             console.log('SOVR sacrifice successful:', result);
          }

        } catch (err: any) {
          console.error('Error processing payment with SOVR service:', err.message);
          // Optionally, you could send a failure notification here
        }
        // --- End of new business logic ---
        break;
     case 'customer.created':
       const customer = event.data.object as Stripe.Customer;
       console.log('Customer was created:', customer.id);
       // You can add any additional logic here, such as sending a welcome email.
       break;
      // ... handle other event types
     default:
       console.log(`Unhandled event type ${event.type}`);
   }

    // Return a 200 response to acknowledge receipt of the event
    res.send();
  }
);

export default router;
