import rateLimit from "express-rate-limit";

const jsonTooMany = (message: string) => ({
  error: message,
});

/** Brute-force protection for password login. */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: jsonTooMany("Too many login attempts. Please try again in a few minutes."),
});

/** Spam protection for patient self-registration. */
export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: jsonTooMany("Too many signup attempts from this network. Please try again later."),
});

/** Limit Google OAuth start redirects (login + signup). */
export const googleAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: jsonTooMany("Too many Google sign-in attempts. Please try again in a few minutes."),
});

/** Public contact form spam protection. */
export const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: jsonTooMany("Too many contact messages. Please try again later."),
});

/** Public booking request spam protection. */
export const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: jsonTooMany("Too many booking requests. Please try again later."),
});

const isDev = process.env.NODE_ENV !== "production";

/** Password reset request spam protection (loose in local/dev so testing isn’t blocked). */
export const forgotPasswordLimiter = rateLimit({
  windowMs: isDev ? 60 * 1000 : 60 * 60 * 1000,
  limit: isDev ? 100 : 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: jsonTooMany("Too many password reset requests. Please try again later."),
});

/** Password reset submit protection. */
export const resetPasswordLimiter = rateLimit({
  windowMs: isDev ? 60 * 1000 : 60 * 60 * 1000,
  limit: isDev ? 100 : 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: jsonTooMany("Too many password reset attempts. Please try again later."),
});
