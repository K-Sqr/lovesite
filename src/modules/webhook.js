// Set this to receive the response (Yes/No) when she clicks:
// - Formspree: 'https://formspree.io/f/YOUR_FORM_ID'
// - Discord webhook: 'https://discord.com/api/webhooks/YOUR_WEBHOOK'
const RESPONSE_WEBHOOK_URL = '';

export function sendResponse(choice) {
  if (!RESPONSE_WEBHOOK_URL) return;
  fetch(RESPONSE_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ response: choice, timestamp: new Date().toISOString() }),
  }).catch(() => {});
}
