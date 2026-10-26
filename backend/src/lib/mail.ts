import nodemailer from "nodemailer";
import { isProduction } from "./env.js";
import { logError, logInfo } from "./logger.js";

export function smtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim() &&
      process.env.SMTP_FROM?.trim(),
  );
}

/** Fail fast in production when mail is required for password reset. */
export function assertSmtpProductionConfig() {
  if (!isProduction()) return;
  if (!smtpConfigured()) {
    throw new Error(
      "SMTP is required in production (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM). Use a Gmail App Password, not your normal password.",
    );
  }
}

function createTransport() {
  const host = process.env.SMTP_HOST!.trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER!.trim();
  // Gmail app passwords are often shown with spaces — strip them.
  const pass = process.env.SMTP_PASS!.replace(/\s+/g, "");
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

  const from = process.env.SMTP_FROM!.trim();
  const transport = createTransport();
  try {
    await transport.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return true;
  } catch (err) {
    logError("mail.send", err);
    throw err;
  }
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const subject = "Reset your Filfilu HMS password";
  const text =
    `You requested a password reset for Filfilu HMS.\n\n` +
    `Open this link within 1 hour:\n${resetUrl}\n\n` +
    `If you did not request this, you can ignore this email.`;
  const html = `
    <p>You requested a password reset for <strong>Filfilu HMS</strong>.</p>
    <p><a href="${resetUrl}">Reset your password</a> (link expires in 1 hour).</p>
    <p>If you did not request this, you can ignore this email.</p>
  `;
  return sendMail({ to, subject, text, html });
}
