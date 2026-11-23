// Copy this file to config.js and set the deployed Cloudflare Worker URL.
// Secrets such as Airtable and Bubble tokens must live in the Worker only.
window.MATZMIHIM_CONFIG = {
  API_BASE_URL: 'https://matzmihim-registration-api.YOUR_SUBDOMAIN.workers.dev',
  // Link to the platform login; shown to teachers who are already registered.
  PLATFORM_URL: '',
};
