import { detectionColor } from "../utils/detectionColors.js";

export default function DetectionBox({ item, face = false, fall = false, objectClasses = [] }) {
  const { x, y, width, height } = item.box;
  const fallStatus = item.fall?.status;
  const label = face
      ? `${item.name}${item.trackId ? ` · #${item.trackId}` : ""}`
      : fall
        ? `${fallStatus === "confirmed" ? "ĐÃ XÁC NHẬN NGÃ" : fallStatus === "suspected" ? "Nghi ngã" : "Bình thường"}${item.trackId ? ` · #${item.trackId}` : ""}`
      : `${item.label} ${Math.round(item.confidence * 100)}%`;
  const boxColor = face
    ? item.name === "Unknown" ? "var(--danger)" : "var(--cyan)"
    : fallStatus === "confirmed" ? "var(--danger)" : fallStatus === "suspected" ? "var(--gesture)"
    : detectionColor(item.label, objectClasses);

  return (
    <div
      className={`detection-box ${face ? "face-box" : ""}`}
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
