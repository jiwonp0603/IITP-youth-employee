export function normalizeExtractedText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

export function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.trim().match(/(?<!\d)(\d{4})[.\-/]?\s*(\d{1,2})[.\-/]?\s*(\d{1,2})(?!\d)/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

export function findLabeledValue(
  lines: string[],
  label: RegExp,
  stopLabels: string[],
): string | null {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(label);
    if (!match) continue;

    let value = line.slice((match.index ?? 0) + match[0].length).replace(/^\s*[:：]?\s*/, "");
    if (!value && lines[index + 1]) value = lines[index + 1];

    for (const stopLabel of stopLabels) {
      const stopIndex = value.indexOf(stopLabel);
      if (stopIndex >= 0) value = value.slice(0, stopIndex);
    }

    const cleaned = value.replace(/^[|｜\s]+|[|｜\s]+$/g, "").replace(/\s+/g, " ").trim();
    if (cleaned) return cleaned;
  }

  return null;
}
