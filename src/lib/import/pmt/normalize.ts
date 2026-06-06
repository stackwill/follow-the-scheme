export function parseSessionLabel(label: string) {
  const match = label.match(/(June|Nov(?:ember)?)\s+(\d{4})/i);

  if (!match) {
    throw new Error(`Unsupported session label: ${label}`);
  }

  const month = match[1].toLowerCase().startsWith("nov") ? "November" : "June";

  return {
    sessionLabel: `${month} ${match[2]}`,
    year: Number(match[2]),
  };
}
