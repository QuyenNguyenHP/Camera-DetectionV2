const DETECTION_PALETTE = [
  "#38bdf8", // blue
  "#fb7185", // rose
  "#fbbf24", // amber
  "#a78bfa", // violet
  "#34d399", // green
  "#fb923c", // orange
  "#f472b6", // pink
  "#2dd4bf", // teal
  "#c084fc", // purple
  "#bef264", // lime
];

export function detectionColor(label, objectClasses = []) {
  const normalizedLabel = label.trim().toLowerCase();
  const classIndex = objectClasses.findIndex(
    (item) => item.trim().toLowerCase() === normalizedLabel,
  );

  if (classIndex >= 0) return DETECTION_PALETTE[classIndex % DETECTION_PALETTE.length];

  let hash = 0;
  for (const character of normalizedLabel) {
    hash = ((hash << 5) - hash + character.codePointAt(0)) | 0;
  }
  return DETECTION_PALETTE[Math.abs(hash) % DETECTION_PALETTE.length];
}
