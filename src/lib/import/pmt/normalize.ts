export function parseSessionLabel(label: string) {
  const match = label.match(/June\s+(\d{4})/i);

  if (!match) {
    throw new Error(`Unsupported session label: ${label}`);
  }

  return {
    sessionLabel: `June ${match[1]}`,
    year: Number(match[1]),
  };
}
