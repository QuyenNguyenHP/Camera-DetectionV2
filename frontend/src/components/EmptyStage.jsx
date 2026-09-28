import { Camera, ScanFace } from "lucide-react";

export default function EmptyStage({ onCamera }) {
  return (
    <div className="empty-state">
      <div className="scanner-mark"><ScanFace size={44} /></div>
      <p className="eyebrow">Ready to observe</p>
      <h2>Bring a scene into focus</h2>
      <p>Chọn camera để bắt đầu giám sát và phân tích tự động.</p>
      <div className="empty-actions">
        <button className="primary" onClick={onCamera}><Camera size={18} /> Start camera</button>
      </div>
    </div>
  );
}
