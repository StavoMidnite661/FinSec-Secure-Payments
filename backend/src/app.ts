// backend/src/app.ts
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import Stripe from "stripe";
import { EventListenerService } from "./services/event-listener.service";
import paymentRoutes from "./controllers/payment.controller";
import webhookRoutes from "./controllers/webhook.controller";

const app = express();
const port = process.env.PORT || 3000;

// Use express.raw() for the webhook endpoint, and express.json() for all other routes.
// This must be done before any other app.use() calls that might parse the body.
app.use(
  '/api/webhook',
  express.raw({ type: 'application/json' }),
  webhookRoutes
);

app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.send('SOVR Credit Bridge Backend is running!');
});

// Mount the payment query routes
app.use('/api/payment', paymentRoutes);

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws, req) => {
  console.log("WebSocket client connected");
  // TODO: Authenticate the user using the token from the query string
  // For now, just log the connection

  ws.on("message", (message) => {
    console.log(`Received message: ${message}`);
  });

  ws.on("close", () => {
    console.log("WebSocket client disconnected");
  });
});

(async () => {
  // Init stripe
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2023-10-16",
  });

  // Init event listener (graceful failure for testing)
  try {
    const listener = new EventListenerService(stripe);
    await listener.start();
  } catch (error) {
    console.error("Blockchain event listener failed to start:", error instanceof Error ? error.message : String(error));
    console.log("⚠️  Continuing without blockchain integration for testing purposes...");
    console.log("✅ Backend API will still function for Stripe payment processing");
  }
})();

server.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});