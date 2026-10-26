/**
 * Runtime config for Filfilu landing pages.
 *
 * Product host: Express serves landing + /api together (same origin) — leave apiBase empty.
 * GitHub Pages / static host: set FILFILU_API_BASE to your deployed API, e.g.
 *   window.FILFILU_API_BASE = "https://your-api.example.com/api";
 * and set backend CORS_ORIGIN / FRONTEND_ORIGIN to the Pages origin.
 */
window.FILFILU_API_BASE = window.FILFILU_API_BASE || "";
window.FILFILU_STATIC_HOST = Boolean(window.FILFILU_STATIC_HOST);
