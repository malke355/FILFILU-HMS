import nodemailer from "nodemailer";
import { isProduction, stripEnvQuotes } from "./env.js";
import { logError, logInfo } from "./logger.js";

function smtpEnv(name: string) {
  return stripEnvQuotes(process.env[name]);
}

export function smtpConfigured() {
  return Boolean(smtpEnv("SMTP_HOST") && smtpEnv("SMTP_USER") && smtpEnv("SMTP_PASS") && smtpEnv("SMTP_FROM"));
}

/**
 * Production can boot without SMTP (login/API still work).
 * Password-reset email stays unavailable until SMTP_* is set on the host.
 */
export function assertSmtpProductionConfig() {
  if (!isProduction()) return;
  if (!smtpConfigured()) {
    logInfo("smtp.optional", {
      message:
        "SMTP_* not set — password-reset email disabled until SMTP_HOST/USER/PASS/FROM are configured.",
    });
  }
}

function createTransport() {
  const host = smtpEnv("SMTP_HOST");
  const port = Number(smtpEnv("SMTP_PORT") || 587);
  const user = smtpEnv("SMTP_USER");
  // Gmail app passwords are often shown with spaces — strip them.
  const pass = smtpEnv("SMTP_PASS").replace(/\s+/g, "");
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * Sends email when SMTP is configured.
 * Returns false if SMTP is not configured (dev can still use devResetUrl).
 * Throws on SMTP send failure so callers can decide how to respond.
 */
export async function sendMail(input: SendMailInput): Promise<boolean> {
  if (!smtpConfigured()) {
    if (!isProduction()) {
      logInfo("[mail] SMTP not configured — skipping send (dev).");
    }
    return false;
  }

  const from = smtpEnv("SMTP_FROM");
  const transport = createTransport();
  try {
    await transport.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    logInfo("mail.send.ok", { to: input.to, subject: input.subject });
    return true;
  } catch (err) {
    logError("mail.send", err);
    throw err;
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const subject = "Set or reset your Filfilu HMS password";
  const text =
    `You requested a password for Filfilu HMS.\n\n` +
    `Open this link within 1 hour (Set new password page — not login):\n${resetUrl}\n\n` +
    `After you set a password you can sign in with email+password or Google.\n` +
    `If you did not request this, you can ignore this email.`;
  const html = `
    <p>You requested a password for <strong>Filfilu HMS</strong>.</p>
    <p><a href="${resetUrl}">Set a new password</a> (opens the password form — not the login page).</p>
    <p style="word-break:break-all;font-size:14px;">If the button fails, paste this URL:<br/>${resetUrl}</p>
    <p>After you set a password you can sign in with email+password or Google. Link expires in 1 hour.</p>
    <p>If you did not request this, you can ignore this email.</p>
  `;
  return sendMail({ to, subject, text, html });
}
