import { safeErrorMessage } from "./privacy.js";

/** Structured logging without dumping PHI-bearing objects in production. */
export function logError(context: string, err: unknown) {
  if (process.env.NODE_ENV === "production") {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: unknown }).code ?? "")
        : "";
    console.error(`[${context}]`, safeErrorMessage(err), code ? `code=${code}` : "");
    return;
  }
  console.error(`[${context}]`, err);
}

export function logInfo(message: string) {
  console.info(message);
}
