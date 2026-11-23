export function composeDisplayName(parts: {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  name?: string | null;
}) {
  const joined = [parts.firstName, parts.middleName, parts.lastName]
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .join(" ");
  return joined || (parts.name || "").trim() || "Unknown";
}

export function ageFromDob(dob: Date | null | undefined, fallback?: number | null) {
  if (!dob) return fallback ?? null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age >= 0 && age < 150 ? age : fallback ?? null;
}
