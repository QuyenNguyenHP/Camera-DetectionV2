import { Camera, ImagePlus, ScanFace } from "lucide-react";

export default function EnrollmentCameraBox({
  source,
  imageUrl,
  videoRef,
  cameraReady,
  busy,
  onStartCamera,
  onUpload,
}) {
  return (
    <div className="viewer-card enrollment-viewer">
      <div className="viewer-toolbar"><div><span className="live-dot" /> ENROLLMENT SOURCE</div></div>
      <div className="stage enrollment-stage">
        {source === "empty" && (
          <div className="empty-state">
            <div className="scanner-mark"><ScanFace size={44} /></div>
            <p className="eyebrow">One person per photo</p>
            <h2>Choose an enrollment portrait</h2>
            <p>Face embeddings and a copy of the enrollment photo remain on your local service.</p>
            <div className="empty-actions">
              <button className="primary" onClick={onStartCamera}><Camera size={18} /> Start camera</button>
              <label className="button secondary">
                <ImagePlus size={18} /> Upload photo
                <input type="file" accept="image/*" onChange={onUpload} />
              </label>
            </div>
          </div>
        )}
        {source === "image" && (
          <div className="media-wrap enrollment-media"><img src={imageUrl} alt="Identity to enroll" /></div>
        )}
        {source === "camera" && (
          <div className="media-wrap enrollment-media">
            <video ref={videoRef} autoPlay playsInline muted />
            {!cameraReady && <div className="camera-loading"><Camera size={24} /><span>Starting camera…</span></div>}
          </div>
        )}
      </div>
      {source !== "empty" && (
        <div className="viewer-actions">
          <button className="secondary" onClick={onStartCamera} disabled={busy}><Camera size={17} /> Camera</button>
          <label className={`button secondary ${busy ? "disabled" : ""}`}>
            <ImagePlus size={17} /> Upload
            <input type="file" accept="image/*" onChange={onUpload} disabled={busy} />
          </label>
        </div>
      )}
    </div>
  );
}
