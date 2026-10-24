import type { Response } from "express";

export const SESSION_COOKIE = "filfilu_token";
export const OAUTH_STATE_COOKIE = "filfilu_oauth_state";
/** Stores Google OAuth intent: "login" or "signup:<role>" */
export const OAUTH_MODE_COOKIE = "filfilu_oauth_mode";

function cookieSecure() {
  return process.env.NODE_ENV === "production";
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
  });
}

export function setOAuthStateCookie(res: Response, state: string) {
  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60 * 1000,
  });
}

export function clearOAuthStateCookie(res: Response) {
  res.clearCookie(OAUTH_STATE_COOKIE, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
  });
}

export function setOAuthModeCookie(res: Response, mode: string) {
  res.cookie(OAUTH_MODE_COOKIE, mode, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60 * 1000,
  });
}

export function clearOAuthModeCookie(res: Response) {
  res.clearCookie(OAUTH_MODE_COOKIE, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
  });
}
