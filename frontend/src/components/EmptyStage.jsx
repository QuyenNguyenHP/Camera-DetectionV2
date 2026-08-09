import { Camera, ImagePlus, ScanFace } from "lucide-react";

export default function EmptyStage({ onCamera, onUpload }) {
  return (
    <div className="empty-state">
      <div className="scanner-mark"><ScanFace size={44} /></div>
      <p className="eyebrow">Ready to observe</p>
      <h2>Bring a scene into focus</h2>
      <p>Use your camera or choose a photo. Processing stays on your own services.</p>
      <div className="empty-actions">
        <button className="primary" onClick={onCamera}><Camera size={18} /> Start camera</button>
        <label className="button secondary">
          <ImagePlus size={18} /> Upload image
          <input type="file" accept="image/*" onChange={onUpload} />
        </label>
      </div>
    </div>
  );
}
