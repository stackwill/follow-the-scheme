export function isPasswordConfigured() {
  return Boolean(process.env.AUTH_SESSION_SECRET);
}

export function normalizeSchoolAnswer(input: string) {
  return input
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function verifyPassword(input: string) {
  const normalized = normalizeSchoolAnswer(input);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const compact = tokens.join("");
  const hasKing = tokens.includes("king") || tokens.includes("kings");
  const hasEly = tokens.includes("ely");

  return (hasKing && hasEly) || compact === "kingely" || compact === "kingsely" || compact === "elyking" || compact === "elykings";
}
