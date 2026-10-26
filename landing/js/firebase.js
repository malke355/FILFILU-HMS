/**
 * Firebase Auth was removed from Filfilu.
 * Password reset is handled by the Express API (Postgres + bcrypt):
 *   POST /api/auth/forgot-password
 *   POST /api/auth/reset-password
 */
console.info("Filfilu: Firebase is not used. Use /forgot-password for account password resets.");
