console.log("FinSec Background Service Worker loaded.");
const POLY_URL = "ws://localhost:3000"; // polygon backend - UPDATE THIS WITH NGROK URL


// --- Message Routing ---
// A more structured router for incoming messages.
const messageRouter = {
  initiateLogin: async (message, sender, sendResponse) => {
    try {
      const token = await getAuthTokenSecurely(true); // Interactive
      console.log("Authentication successful. Token acquired:", token);
      connectWebSocket(token); // Connect WebSocket on successful login
      sendResponse({ status: "success", token: token });
    } catch (error) {
      console.error("Login failed:", error);
      sendResponse({ status: "error", error: error.message });
    }
  },

  initiateLogout: async (message, sender, sendResponse) => {
    try {
      const tokenValue = await getAuthTokenSecurely(false).catch(() => null);
      if (tokenValue) {
        // Defensively handle token which might be a string or an object
        const tokenToRemove = (typeof tokenValue === 'string') ? tokenValue : tokenValue.token;
        
        if (tokenToRemove) {
          await chrome.identity.removeCachedAuthToken({ token: tokenToRemove });
          console.log("User logged out and token cache cleared.");
        } else {
          console.warn("Logout initiated, but no valid token string found to remove.");
        }
      }
      disconnectWebSocket();
      sendResponse({ status: "success" });
    } catch (error) {
      console.error("Error during logout:", error);
      // Still attempt to disconnect and respond successfully to the UI
      disconnectWebSocket();
      sendResponse({ status: "success", message: "Logout completed with an error." });
    }
  },

  initiatePayment: (message, sender, sendResponse) => {
    handleInitiatePayment(message.data, sendResponse);
    return true; // Indicate async response
  }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = messageRouter[message.action];
  if (handler) {
    // Wrap handler call in a promise to handle both sync and async functions
    Promise.resolve(handler(message, sender, sendResponse)).catch(error => {
      console.error(`Error in message handler for '${message.action}':`, error);
      sendResponse({ status: "error", error: error.message });
    });
    return true; // Indicates an asynchronous response.
  } else {
    console.warn("Unknown message action:", message.action);
    sendResponse({ status: "error", error: "Unknown action" });
  }
});

// Example: Handle extension installation/update
chrome.runtime.onInstalled.addListener(() => {
  console.log("FinSec extension installed or updated.");
  // On startup, check if user is already logged in and connect WebSocket if so.
  getAuthTokenSecurely(false).then(token => {
    if (token) {
      connectWebSocket(token);
    }
  }).catch(() => { /* Silently fail if not logged in */ });
});

// --- SCA and Asynchronous Payment Handling ---

// Global map to keep track of ongoing SCA flows. Key: transactionId, Value: { tabId }
const pendingScaTransactions = new Map();

async function handleInitiatePayment(transactionData, sendResponse) {
  try {
    const token = await getAuthTokenSecurely(false);
    validateTransactionData(transactionData);

    const backendResponse = await fetch(`http://localhost:3000/api/payment/initiate`, { // UPDATE THIS WITH NGROK URL
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(transactionData)
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({ message: 'Unknown backend error.' }));
      throw new Error(errorData.message || `Backend payment initiation failed: ${backendResponse.status}`);
    }

    const paymentResult = await backendResponse.json();

    if (paymentResult.requiresSCA && paymentResult.redirectUrl) {
      const transactionId = paymentResult.transactionId;
      if (!transactionId) throw new Error("Backend did not provide a transactionId for SCA redirect.");

      const newTab = await chrome.tabs.create({ url: paymentResult.redirectUrl, active: true });
      pendingScaTransactions.set(transactionId, { tabId: newTab.id });

      sendResponse({
        status: "pending_sca",
        message: "Please complete authentication in the new tab.",
        transactionId: transactionId
      });
    } else {
      // Direct payment completion or failure
      sendResponse({
        status: paymentResult.status || 'success',
        message: paymentResult.message || 'Payment initiated successfully.',
        data: paymentResult
      });
      // Also push a final status update
      notifyFrontendOfPaymentStatus(paymentResult.transactionId, paymentResult);
    }
  } catch (error) {
    console.error("Service Worker: Payment initiation failed:", error);
    sendResponse({ status: "error", error: error.message });
  }
}

// Listener for tab updates to catch the SCA callback
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url && changeInfo.url.startsWith(`http://localhost:3000/payment-callback`)) { // UPDATE THIS WITH NGROK URL
    for (const [transactionId, scaInfo] of pendingScaTransactions.entries()) {
      if (scaInfo.tabId === tabId) {
        console.log(`SCA callback detected for transaction ${transactionId}.`);
        // The backend will receive the final status and should push it to us.
        // For now, we can close the tab and clean up.
        chrome.tabs.remove(tabId);
        pendingScaTransactions.delete(transactionId);
        break;
      }
    }
  }
});

// Example function to notify popup or create a system notification
async function notifyFrontendOfPaymentStatus(transactionId, statusData) {
  // This function would be called by a push from the backend (e.g., WebSocket listener)
  // For now, we simulate it being called after a direct payment.
  const message = { action: "paymentStatusUpdate", data: { transactionId, ...statusData } };

  // Try to send to popup
  chrome.runtime.sendMessage(message).catch(e => {
    // If popup is not open, it will error. We can then show a notification.
    console.log("Popup not open. Sending a system notification.");
    chrome.notifications.create(transactionId, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: `Payment ${statusData.status}`,
      message: statusData.message || `Your payment has completed with status: ${statusData.status}.`
    });
  });
}

// Wrapper for getting auth token with better error handling
async function getAuthTokenSecurely(interactive) {
  try {
    return await chrome.identity.getAuthToken({ interactive });
  } catch (error) {
    console.error("getAuthToken failed:", error.message);
    throw new Error("Authentication failed. Please try logging in again.");
  }
}

// Placeholder for data validation
function validateTransactionData(data) {
  if (!data || typeof data.amount !== 'number' || data.amount <= 0 || !data.currency) {
    throw new Error("Invalid transaction data provided.");
  }
  return true;
}

// --- Real-time Backend Push Notification Handling (WebSocket) ---

let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000; // 1 second

function connectWebSocket(token) {
  // Prevent multiple connections
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    console.log("WebSocket is already open or connecting.");
    return;
  }

  if (!token) {
    console.error("Cannot connect WebSocket without an authentication token.");
    return;
  }

  // Authenticate the WebSocket connection by passing the token as a query parameter.
  const socketUrl = `${POLY_URL}/ws?token=${token}`;
  socket = new WebSocket(socketUrl);
  
  socket.onopen = () => {
    console.log("WebSocket connection established.");
    reconnectAttempts = 0; // Reset reconnect counter on successful connection
  };

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === 'paymentStatusUpdate' && message.payload) {
        const { transactionId, ...statusData } = message.payload;
        console.log(`Received payment status update via WebSocket for transaction ${transactionId}`);
        notifyFrontendOfPaymentStatus(transactionId, statusData);
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
    }
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  socket.onclose = () => {
    console.log("WebSocket connection closed. Attempting to reconnect...");
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      const delay = Math.pow(2, reconnectAttempts) * BASE_RECONNECT_DELAY;
      // Re-acquire token before reconnecting in case it has expired.
      setTimeout(() => {
        getAuthTokenSecurely(false).then(freshToken => {
          if (freshToken) connectWebSocket(freshToken);
        }).catch(() => console.error("Could not get token for WebSocket reconnect."));
      }, Math.min(delay, 30000)); // Cap delay at 30s
      reconnectAttempts++;
    } else {
      console.error("Max WebSocket reconnect attempts reached. Will not try again until next extension startup.");
    }
  };
}
function disconnectWebSocket() {
  if (socket) {
    socket.close(1000, "User logged out"); // 1000 is a normal closure
    socket = null;
  }
}
