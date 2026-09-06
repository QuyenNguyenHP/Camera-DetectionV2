const BONES = [[0, 1], [0, 2], [1, 3], [2, 4], [5, 6], [5, 7], [7, 9],
  [6, 8], [8, 10], [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16]];
const visible = (point) => point && point.confidence >= 0.5 && Number.isFinite(point.x) && Number.isFinite(point.y);

export default function PoseOverlay({ poses = [] }) {
  if (!poses.length) return null;
  return (
    <svg aria-label="Body pose skeletons" viewBox="0 0 1000 1000" preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      {poses.map((pose, index) => (
        <g key={index} stroke="#55dfd2" fill="#fff" strokeWidth="2">
          {BONES.map(([a, b]) => visible(pose.keypoints[a]) && visible(pose.keypoints[b]) && (
            <line key={`${a}-${b}`} x1={pose.keypoints[a].x * 1000} y1={pose.keypoints[a].y * 1000}
              x2={pose.keypoints[b].x * 1000} y2={pose.keypoints[b].y * 1000} vectorEffect="non-scaling-stroke" />
          ))}
          {pose.keypoints.map((point, id) => visible(point) && (
            <circle key={id} cx={point.x * 1000} cy={point.y * 1000} r="4" />
          ))}
        </g>
      ))}
    </svg>
  );
}
