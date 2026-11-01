import "dotenv/config";
import nodemailer from "nodemailer";
import { PrismaClient } from "@prisma/client";

function clean(v) {
  const s = (v || "").trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1).trim();
  }
  return s;
}

const host = clean(process.env.SMTP_HOST);
const user = clean(process.env.SMTP_USER);
const pass = clean(process.env.SMTP_PASS).replace(/\s+/g, "");
const from = clean(process.env.SMTP_FROM);
const port = Number(clean(process.env.SMTP_PORT) || 587);
const email = process.argv[2] || "tmelkamu550@gmail.com";

console.log(
  JSON.stringify(
    { host, port, user, from, passLen: pass.length, configured: Boolean(host && user && pass && from) },
    null,
    2,
  ),
);

const prisma = new PrismaClient();
const u = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
console.log(
  "user:",
  u
    ? {
        role: u.role,
        hasPassword: Boolean(u.passwordHash),
        googleOnly: Boolean(u.googleSub && !u.passwordHash),
      }
    : null,
);

const recent = await prisma.user.findMany({
  select: { email: true, role: true, passwordHash: true, googleSub: true },
  orderBy: { createdAt: "desc" },
  take: 40,
});
console.log(
  "accounts:",
  recent.map((r) => ({
    email: r.email,
    role: r.role,
    hasPassword: Boolean(r.passwordHash),
    hasGoogle: Boolean(r.googleSub),
  })),
);

const t = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user, pass },
});

try {
  await t.verify();
  console.log("smtp_verify: ok");
  if (process.env.SMTP_SEND_TEST === "1") {
    const info = await t.sendMail({
      from,
      to: email,
      subject: "Filfilu SMTP test",
      text: "If you got this, SMTP works for Filfilu password reset.",
    });
    console.log("smtp_send: ok", info.messageId);
  } else {
    console.log("smtp_send: skipped (set SMTP_SEND_TEST=1 to send)");
  }
} catch (e) {
  console.log("smtp_error:", e?.message || String(e));
  if (e?.response) console.log("smtp_response:", e.response);
  if (e?.code) console.log("smtp_code:", e.code);
}

await prisma.$disconnect();
