import { detectionColor } from "../utils/detectionColors.js";

export default function DetectionBox({ item, face = false, hand = false, objectClasses = [] }) {
  const { x, y, width, height } = item.box;
  const label = hand
    ? `${item.gesture.replaceAll("_", " ")} · ${item.handedness} ${Math.round(item.confidence * 100)}%`
    : face
      ? `${item.name}${item.trackId ? ` · #${item.trackId}` : ""}`
      : `${item.label} ${Math.round(item.confidence * 100)}%`;
  const boxColor = hand
    ? "var(--gesture)"
    : face
    ? item.name === "Unknown" ? "var(--danger)" : "var(--cyan)"
    : detectionColor(item.label, objectClasses);

  return (
    <div
      className={`detection-box ${face ? "face-box" : ""} ${hand ? "hand-box" : ""}`}
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        width: `${width * 100}%`,
        height: `${height * 100}%`,
        "--detection-color": boxColor,
      }}
    >
      <span>{label}</span>
    </div>
  );
}
