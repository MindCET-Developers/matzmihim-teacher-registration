// Copy this file to config.js and set the deployed Cloudflare Worker URL.
// Secrets such as Airtable and Bubble tokens must live in the Worker only.
window.MATZMIHIM_CONFIG = {
  API_BASE_URL: 'https://matzmihim-registration-api.YOUR_SUBDOMAIN.workers.dev',
  // Link to the platform login; shown to teachers who are already registered.
  // In production this comes from deploy.yml (repo variable PLATFORM_URL, with a default).
  PLATFORM_URL: 'https://matzmihim-teachers.bubbleapps.io/',
};
