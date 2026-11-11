/**
 * Deploy gas/Code.gs as a Google Apps Script Web App, then set:
 * VITE_GAS_ENDPOINT=https://script.google.com/macros/s/<deployment-id>/exec
 *
 * Keep this URL public-safe: it is not a secret. Do not put spreadsheet or
 * Drive credentials in the frontend.
 */
export const GAS_ENDPOINT = (import.meta.env.VITE_GAS_ENDPOINT ?? '').trim();
export const GAS_ENABLED = GAS_ENDPOINT.length > 0;
