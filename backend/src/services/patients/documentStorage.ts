import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
]);

const MAX_BYTES = Number(process.env.PATIENT_DOC_MAX_BYTES || 10 * 1024 * 1024); // 10MB

export function storageRoot() {
  const configured = process.env.STORAGE_ROOT?.trim();
  if (configured) return path.resolve(configured);
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../storage");
}

export function assertAllowedUpload(mimeType: string, sizeBytes: number) {
  if (!ALLOWED_MIME.has(mimeType)) {
    const err = new Error("File type not allowed. Use PDF, JPEG, PNG, WebP, or plain text.");
    (err as Error & { status?: number }).status = 400;
    throw err;
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_BYTES) {
    const err = new Error(`File exceeds size limit (${Math.floor(MAX_BYTES / (1024 * 1024))}MB).`);
    (err as Error & { status?: number }).status = 400;
    throw err;
  }
}

export async function savePatientDocumentFile(input: {
  facilityId: string;
  patientId: string;
  originalName: string;
  mimeType: string;
  buffer: Buffer;
}) {
  assertAllowedUpload(input.mimeType, input.buffer.length);
  const safeExt = path.extname(input.originalName || "").slice(0, 12).replace(/[^\w.]/g, "") || "";
  const fileId = crypto.randomBytes(16).toString("hex");
  const storageKey = path.posix.join(
    "facilities",
    input.facilityId,
    "patients",
    input.patientId,
    `${fileId}${safeExt}`,
  );
  const abs = path.join(storageRoot(), storageKey);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, input.buffer, { flag: "wx" });
  return { storageKey, sizeBytes: input.buffer.length, absPath: abs };
}

export function absoluteStoragePath(storageKey: string) {
  const root = storageRoot();
  const abs = path.resolve(root, storageKey);
  if (!abs.startsWith(root)) {
    const err = new Error("Invalid storage key.");
    (err as Error & { status?: number }).status = 400;
    throw err;
  }
  return abs;
}

export async function deleteStoredFile(storageKey: string) {
  try {
    await fs.unlink(absoluteStoragePath(storageKey));
  } catch {
    /* ignore missing */
  }
}

export { ALLOWED_MIME, MAX_BYTES };
