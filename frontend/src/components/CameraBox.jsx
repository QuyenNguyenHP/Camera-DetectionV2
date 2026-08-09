import { Aperture, Camera, CircleStop, Clock3, ImagePlus, Wifi } from "lucide-react";
import DetectionBox from "./DetectionBox.jsx";
import EmptyStage from "./EmptyStage.jsx";

function DetectionOverlay({ result, objectClasses }) {
  return (
    <div className="overlay">
      {result?.detections.map((item, index) => (
        <DetectionBox key={`d-${item.trackId ?? `${item.label}-${index}`}`} item={item} objectClasses={objectClasses} />
      ))}
      {result?.faces.map((item, index) => (
        <DetectionBox key={`f-${item.trackId ?? index}`} item={item} face />
      ))}
    </div>
  );
}

export default function CameraBox({
  mode,
  imageUrl,
  videoRef,
  cameraReady,
  result,
  classes,
  cameras,
  selectedCameraId,
  busy,
  live,
  onStartCamera,
  onChangeCamera,
  onUpload,
  onScan,
  onToggleLive,
}) {
  const sourceLabel = mode === "camera" ? "CAMERA 01" : mode === "image" ? "UPLOADED FRAME" : "NO SOURCE";
  const objectClasses = classes.split(",").map((item) => item.trim()).filter(Boolean);

  return (
    <div className="viewer-card">
      <div className="viewer-toolbar">
        <div><span className="live-dot" /> {sourceLabel}</div>
        {result && <span><Clock3 size={14} /> {result.processingMs} ms</span>}
      </div>
      <div className="stage">
        {mode === "empty" && <EmptyStage onCamera={onStartCamera} onUpload={onUpload} />}
        {mode === "image" && (
          <div className="media-wrap">
            <img src={imageUrl} alt="Scene to analyze" />
            <DetectionOverlay result={result} objectClasses={objectClasses} />
          </div>
        )}
        {mode === "camera" && (
          <div className="media-wrap">
            <video ref={videoRef} autoPlay playsInline muted />
            {!cameraReady && <div className="camera-loading"><Camera size={24} /><span>Đang khởi động camera…</span></div>}
            <DetectionOverlay result={result} objectClasses={objectClasses} />
          </div>
        )}
      </div>
      {mode !== "empty" && (
        <div className="viewer-actions">
          <button className="secondary" onClick={onStartCamera}><Camera size={17} /> Camera</button>
          <label className="camera-picker">
            <Camera size={15} />
            <select aria-label="Chọn camera" value={selectedCameraId} onChange={onChangeCamera} disabled={busy || live}>
              <option value="">Camera mặc định</option>
              {cameras.map((camera, index) => (
                <option key={camera.deviceId || `camera-${index}`} value={camera.deviceId}>{camera.label}</option>
              ))}
            </select>
          </label>
          <label className="button secondary">
            <ImagePlus size={17} /> Upload
            <input type="file" accept="image/*" onChange={onUpload} />
          </label>
          <button className="primary scan-button" disabled={busy || live} onClick={onScan}>
            <Aperture size={18} className={busy && !live ? "spin" : ""} />
            {busy && !live ? "Analyzing…" : "Analyze frame"}
          </button>
          {mode === "camera" && (
            <button className={live ? "danger" : "secondary"} onClick={onToggleLive}>
              {live ? <CircleStop size={17} /> : <Wifi size={17} />}
              {live ? "Stop live" : "Live scan"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
