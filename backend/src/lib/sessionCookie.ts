import type { Response } from "express";
import { accessTokenTtlSeconds } from "./authSession.js";

export const SESSION_COOKIE = "filfilu_token";
export const REFRESH_COOKIE = "filfilu_refresh";
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

/** Short-lived access JWT (default 15m). */
export function setSessionCookie(res: Response, token: string, maxAgeMs?: number) {
  const maxAge = maxAgeMs ?? accessTokenTtlSeconds() * 1000;
  res.cookie(SESSION_COOKIE, token, {
    ...baseCookie(),
    maxAge,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, baseCookie());
}

/** Long-lived refresh token (hashed server-side). */
export function setRefreshCookie(res: Response, token: string, expiresAt: Date) {
  const maxAge = Math.max(0, expiresAt.getTime() - Date.now());
  res.cookie(REFRESH_COOKIE, token, {
    ...baseCookie(),
    maxAge,
  });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, baseCookie());
}

export function clearAuthCookies(res: Response) {
  clearSessionCookie(res);
  clearRefreshCookie(res);
  clearOAuthStateCookie(res);
  clearOAuthModeCookie(res);
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
