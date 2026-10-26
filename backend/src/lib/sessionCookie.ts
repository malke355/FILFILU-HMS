import type { Response } from "express";

export const SESSION_COOKIE = "filfilu_token";
export const OAUTH_STATE_COOKIE = "filfilu_oauth_state";
/** Stores Google OAuth intent: "login" or "signup" */
export const OAUTH_MODE_COOKIE = "filfilu_oauth_mode";

/**
 * Secure cookies on HTTPS.
 * - COOKIE_SECURE=1 force on (recommended behind TLS)
 * - COOKIE_SECURE=0 force off (local http only)
 * - else: on when NODE_ENV=production
 */
export function cookieSecure() {
  const forced = process.env.COOKIE_SECURE?.trim();
  if (forced === "1" || forced === "true") return true;
  if (forced === "0" || forced === "false") return false;
  return process.env.NODE_ENV === "production";
}

function baseCookie() {
  return {
    httpOnly: true as const,
    secure: cookieSecure(),
    sameSite: "lax" as const,
    path: "/",
  };
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    ...baseCookie(),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, baseCookie());
}

export function setOAuthStateCookie(res: Response, state: string) {
  res.cookie(OAUTH_STATE_COOKIE, state, {
    ...baseCookie(),
    maxAge: 10 * 60 * 1000,
  });
}

export function clearOAuthStateCookie(res: Response) {
  res.clearCookie(OAUTH_STATE_COOKIE, baseCookie());
}

export function setOAuthModeCookie(res: Response, mode: string) {
  res.cookie(OAUTH_MODE_COOKIE, mode, {
    ...baseCookie(),
    maxAge: 10 * 60 * 1000,
  });
}

export function clearOAuthModeCookie(res: Response) {
  res.clearCookie(OAUTH_MODE_COOKIE, baseCookie());
}
