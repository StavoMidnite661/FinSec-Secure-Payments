document.addEventListener('DOMContentLoaded', () => {
  // Centralize DOM element lookups for better organization and performance.
  const elements = {
    loginButton: document.getElementById('loginButton'),
    logoutButton: document.getElementById('logoutButton'),
    payButton: document.getElementById('payButton'),
    authSection: document.getElementById('auth-section'),
    userSection: document.getElementById('user-section'),
    paymentSection: document.getElementById('payment-section'),
    separator: document.getElementById('separator'),
    userEmailSpan: document.getElementById('userEmail'),
    merchantNameSpan: document.getElementById('merchantName'),
    paymentAmountSpan: document.getElementById('paymentAmount'),
    paymentCurrencySpan: document.getElementById('paymentCurrency'),
    statusMessage: document.getElementById('statusMessage')
  };

  // Placeholder for current transaction details
  let currentTransaction = null;

  // Function to update UI based on authentication status
  function updateUI(token) {
    if (token) {
      // User is authenticated
      elements.authSection.style.display = 'none';
      elements.userSection.style.display = 'block';
      elements.separator.style.display = 'block';
      
      // Securely get user info from the identity provider instead of decoding the JWT.
      chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (userInfo) => {
        if (userInfo && userInfo.email) {
          elements.userEmailSpan.textContent = userInfo.email;
        } else {
          elements.userEmailSpan.textContent = 'user';
          console.warn("Could not retrieve user info from identity provider.");
        }
      });

      // Show payment section if there's a transaction ready
      elements.paymentSection.style.display = currentTransaction ? 'block' : 'none';
      // The pay button should only be enabled if the user is logged in AND there is a transaction.
      elements.payButton.disabled = !currentTransaction;
    } else {
      // User is not authenticated
      elements.authSection.style.display = 'block';
      elements.userSection.style.display = 'none';
      elements.paymentSection.style.display = 'none';
      elements.separator.style.display = 'none';
      elements.payButton.disabled = true; // Always disable if not logged in.
    }
  }

  // Handle login button click
  elements.loginButton.addEventListener('click', async () => {
    elements.loginButton.disabled = true;
    elements.statusMessage.textContent = 'Attempting to log in...';
    try {
      const response = await chrome.runtime.sendMessage({ action: "initiateLogin" });
      if (response && response.status === 'success') {
        elements.statusMessage.textContent = 'Login successful!';
        updateUI(response.token);
      } else {
        throw new Error(response?.error || 'Unknown login error');
      }
    } catch (error) {
      elements.statusMessage.textContent = `Login failed: ${error.message}`;
      console.error("Login failed:", error);
      updateUI(null);
    } finally {
      elements.loginButton.disabled = false;
    }
  });

  // Handle logout button click
  elements.logoutButton.addEventListener('click', async () => {
    console.log("Logout button clicked."); // New log
    elements.logoutButton.disabled = true;
    elements.statusMessage.textContent = 'Logging out...';
    try {
      console.log("Sending initiateLogout message to background script."); // New log
      const response = await chrome.runtime.sendMessage({ action: "initiateLogout" });
      console.log("Received response from background script:", response); // New log

      if (response && response.status === 'success') {
        elements.statusMessage.textContent = 'You have been logged out.';
        console.log("Logout successful, calling updateUI(null)."); // New log
        updateUI(null);
      } else {
        throw new Error(response?.error || 'Unknown logout error');
      }
    } catch (error) {
      elements.statusMessage.textContent = `Logout failed: ${error.message}`;
      console.error("Logout failed:", error);
    } finally {
      elements.logoutButton.disabled = false;
    }
  });

  // Handle pay button click
  elements.payButton.addEventListener('click', async () => {
    if (!currentTransaction) {
      elements.statusMessage.textContent = 'No payment details available.';
      return;
    }

    elements.payButton.disabled = true;
    elements.statusMessage.textContent = 'Initiating payment... Please wait.';
    try {
      // Send payment initiation request to background script
      const response = await chrome.runtime.sendMessage({
        action: "initiatePayment",
        data: currentTransaction
      });
      console.log("Response from background script (initiation):", response);
      if (response.status === 'pending_sca' || response.status === 'pending') {
        elements.statusMessage.textContent = response.message || 'Awaiting final status...';
        // Do not re-enable pay button; wait for a final status update.
      } else {
        throw new Error(response.error || 'Payment initiation failed.');
      }
    } catch (error) {
      console.error("Payment initiation failed:", error);
      elements.statusMessage.textContent = `Payment failed: ${error.message}`;
      elements.payButton.disabled = false; // Re-enable if initiation itself failed.
    }
  });

  // Listen for messages from other parts of the extension
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "checkoutDetected") {
      // This can be async because it calls getAuthToken, so we return true.
      // Defensive validation
      if (!message.data || typeof message.data.amount !== 'number' || !message.data.currency || !message.data.merchantName) {
        console.error("Invalid checkout data received:", message.data);
        elements.statusMessage.textContent = 'Error reading payment details.';
        currentTransaction = null;
        updateUI();
        sendResponse({ status: "error", message: "Invalid checkout data." });
        return true;
      }

      currentTransaction = message.data;
      elements.merchantNameSpan.textContent = currentTransaction.merchantName;
      elements.paymentAmountSpan.textContent = currentTransaction.amount.toFixed(2);
      elements.paymentCurrencySpan.textContent = currentTransaction.currency;
      elements.statusMessage.textContent = 'Payment details ready.';

      // Check login status to show/hide payment section correctly
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        updateUI(token);
        sendResponse({ status: "success", message: "Popup updated." });
      });

      return true; // Indicates an asynchronous response.
    } else if (message.action === "paymentStatusUpdate") {
      const { transactionId, status, message: statusMsg, error } = message.data;
      console.log(`Payment Update for ${transactionId}: Status - ${status}`);
      elements.statusMessage.textContent = `Payment status: ${statusMsg || status}`;

      if (status === 'AUTHORIZED' || status === 'COMPLETED') {
        elements.payButton.disabled = true;
        elements.paymentSection.style.display = 'none';
        currentTransaction = null;
      } else if (status === 'FAILED' || status === 'DECLINED') {
        elements.statusMessage.textContent = `Payment failed: ${statusMsg || error || 'Please try again.'}`;
        elements.payButton.disabled = false;
      }
      sendResponse({ status: "acknowledged" });
      // No need to return true, response is synchronous.
    }
    // For any other messages, do not return true, allowing other listeners to handle them.
  });

  // Initial UI check on popup open
  // This non-interactive call checks for a cached token without prompting the user.
  // It's a quick and silent way to determine the initial logged-in state.
  chrome.identity.getAuthToken({ interactive: false }, (token) => {
    updateUI(token);
  });
});