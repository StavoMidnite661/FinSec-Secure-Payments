// backend/src/controllers/payment.controller.ts
import express from "express";
import { PaymentService } from "../services/payment.service";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth.middleware";

const router = express.Router();

// Use an IIAFE to asynchronously initialize the service
let service: PaymentService;
(async () => {
  service = await PaymentService.create();
})();

router.get("/payout/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const result = await service.getPayout(req.params.id, userId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/initiate", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { amount, currency, metadata } = req.body;
    if (!amount || !currency) {
      return res.status(400).json({ error: "amount and currency are required" });
    }
    const userId = req.user!.id;
    const result = await service.initiatePayment(amount, currency, userId, metadata);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/sacrifice", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { amount, retailerId, complianceHash } = req.body;
    if (!amount || !retailerId || !complianceHash) {
      return res.status(400).json({ error: "amount, retailerId, and complianceHash are required" });
    }
    // The user's address is retrieved from the authenticated request.
    const userAddress = req.user!.id;
    const result = await service.initiateSacrifice(userAddress, amount, retailerId, complianceHash);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
