// --- Configuration ---
// In a real-world scenario, this would be more complex, potentially loaded from a remote config.
// It maps merchant hostnames to specific selectors for data extraction.
const merchantConfigs = {
  // Example for a generic site structure
  'default': {
    totalAmountSelector: '[data-test="order-total"], .order-total, .total-price',
    currencySelector: '[data-test="currency-symbol"], .currency',
    // A selector for a container that indicates we are on a checkout page. For production,
    // it's highly recommended to create specific merchant configs with selectors that are
    // as precise as possible to ensure accuracy and security.
    checkoutContainerSelector: '#checkout, #checkout-container, form[action*="checkout"]'
  },
  // Example for a specific merchant
  'checkout.merchant-b.com': {
    totalAmountSelector: '.final-price-value',
    currencySelector: '.final-price-currency',
    checkoutContainerSelector: '.checkout-summary-page'
  }
};

let checkoutDataDetected = false;

// --- Constants ---
const currencySymbolMap = new Map([
  ['$', 'USD'],
  ['€', 'EUR'],
  ['£', 'GBP'],
  ['¥', 'JPY'], // Note: ¥ can be JPY or CNY. Context or more specific selectors may be needed.
]);
// --- Core Functions ---

/**
 * Extracts and sanitizes the payment amount from the page.
 * @param {string} selector - The CSS selector for the amount element.
 * @returns {number|null} - The sanitized amount as a float, or null if not found/invalid.
 */
function extractAmount(selector) {
  const element = document.querySelector(selector);
  if (!element) return null;

  // Sanitize: remove currency symbols, commas, and whitespace.
  const sanitizedText = element.textContent.replace(/[^0-9.]/g, '');
  const amount = parseFloat(sanitizedText);

  return !isNaN(amount) ? amount : null;
}

/**
 * Extracts the currency from the page.
 * @param {string} selector - The CSS selector for the currency element.
 * @returns {string} - The currency code (e.g., 'USD'), or a default.
 */
function extractCurrency(selector) {
  const element = document.querySelector(selector);  
  if (!element) return 'USD'; // Default if no element found

  const text = element.textContent.trim();

  // 1. Prioritize explicit ISO 4217 codes (e.g., "USD", "EUR") in the text.
  const isoMatch = text.match(/\b(USD|EUR|GBP|JPY|CAD|AUD)\b/i);
  if (isoMatch) return isoMatch[0].toUpperCase();

  // 2. Look for symbols from our map.
  for (const [symbol, code] of currencySymbolMap.entries()) {
    if (text.includes(symbol)) {
      return code;
    }
  }

  // 3. Fallback to a default. The backend should always validate this.
  return 'USD';
}

/**
 * The main function to find and process checkout details.
 */
async function processCheckoutDetails() {
  // Avoid re-processing if we've already sent the data.
  if (checkoutDataDetected) return;

  const config = merchantConfigs[window.location.hostname] || merchantConfigs['default'];
  const checkoutContainer = document.querySelector(config.checkoutContainerSelector);

  // Only proceed if we are confident we're on a checkout page.
  if (!checkoutContainer) {
    return;
  }

  const amount = extractAmount(config.totalAmountSelector);
  const currency = extractCurrency(config.currencySelector);

  if (amount !== null && amount > 0) {
    const orderDetails = {
      amount: amount,
      currency: currency,
      merchantName: window.location.hostname
    };

    console.log("FinSec: Detected and validated checkout details:", orderDetails);

    try {
      // Send the detected data to the background script.
      await chrome.runtime.sendMessage({ action: "checkoutDetected", data: orderDetails });
      
      // Mark as detected and stop observing only if the message was sent successfully.
      checkoutDataDetected = true;
      observer.disconnect(); 
      console.log("FinSec: Checkout data sent. Observer disconnected.");
    } catch (e) {
      console.error("FinSec: Failed to send checkout details. The background script may be inactive or an error occurred.", e);
      // To prevent spamming the console on a broken background script, we will still
      // mark as detected and disconnect the observer for this page session.
      checkoutDataDetected = true; 
      observer.disconnect();
    }
  }
}

// --- Execution & Observers ---

// Use a MutationObserver to handle dynamically loaded content (common in SPAs).
// This is more efficient and robust than interval-based checks.
const observer = new MutationObserver((mutations) => {
  // We can be smart here, but for now, any significant change triggers a check.
  processCheckoutDetails();
});

// Initial check when the script loads.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', processCheckoutDetails);
} else {
  processCheckoutDetails();
}

// Start observing the body for changes.
observer.observe(document.body, {
  childList: true,
  subtree: true
});

console.log("FinSec Content Script initialized and observing for checkout context.");

// The listener for messages from the background is still relevant for future features.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updatePageUI") {
    console.log("Received instruction to update page UI:", message.data);
    // TODO: Implement UI updates on the merchant page, e.g., showing a "Payment with FinSec successful" confirmation.
    sendResponse({ status: "success", message: "UI updated." });
  }
});