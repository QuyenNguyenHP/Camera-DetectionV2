export default function EyeOverlay({ eyes = [] }) {
  const visible = eyes.filter((eye) => ["open", "closed"].includes(eye.state)
    && eye.points?.length >= 3 && eye.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
  if (!visible.length) return null;
  return (
    <svg aria-label="Trạng thái mắt" viewBox="0 0 1000 1000" preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      {visible.map((eye) => {
        const color = eye.state === "open" ? "#00ff00" : "#ff0000";
        return <polygon key={eye.side} points={eye.points.map((p) => `${p.x * 1000},${p.y * 1000}`).join(" ")}
          fill={color} stroke={color} strokeWidth="3" vectorEffect="non-scaling-stroke" opacity="0.5">
          <title>{eye.side === "left" ? "Mắt trái" : "Mắt phải"}: {eye.state === "open" ? "mở" : "nhắm"}</title>
        </polygon>;
      })}
    </svg>
  );
}
