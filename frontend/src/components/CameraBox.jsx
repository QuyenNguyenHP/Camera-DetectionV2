import { useState } from "react";
import { Camera, CircleStop, Clock3, Wifi } from "lucide-react";
import PoseOverlay from "./PoseOverlay.jsx";
import DetectionBox from "./DetectionBox.jsx";
import EmptyStage from "./EmptyStage.jsx";

function DetectionOverlay({ result }) {
  return (
    <div className="overlay">
      <PoseOverlay poses={result?.poses} />
      {result?.poses?.map((pose, index) => <DetectionBox key={`pose-${pose.trackId ?? index}`} item={pose} fall />)}
      {result?.faces?.map((item, index) => (
        <DetectionBox key={`f-${item.trackId ?? index}`} item={item} face />
      ))}
    </div>
  );
}

export default function CameraBox({
  cameraNumber = 1,
  mode,
  videoRef,
  cameraReady,
  result,
  cameras,
  selectedCameraId,
  busy,
  live,
  onStartCamera,
  onChangeCamera,
  onToggleLive,
}) {
  const [mediaAspect, setMediaAspect] = useState(16 / 9);
  const sourceLabel = mode === "camera" ? `CAMERA ${String(cameraNumber).padStart(2, "0")}` : `CAMERA ${String(cameraNumber).padStart(2, "0")} · NO SOURCE`;

  return (
    <div className="viewer-card">
      <div className="viewer-toolbar">
        <div><span className="live-dot" /> {sourceLabel}</div>
        {result && <span><Clock3 size={14} /> {result.processingMs} ms</span>}
      </div>
      <div className="viewer-actions">
          <label className="camera-picker">
            <Camera size={15} />
            <select aria-label="Chọn camera" value={selectedCameraId} onChange={onChangeCamera} disabled={busy || live}>
              <option value="">Camera mặc định</option>
              {cameras.map((camera, index) => (
                <option key={camera.deviceId || `camera-${index}`} value={camera.deviceId}>{camera.label}</option>
              ))}
            </select>
          </label>
      </div>
      <div className="stage" style={mode !== "empty" ? { aspectRatio: mediaAspect, minHeight: 0 } : undefined}>
        {mode === "empty" && <EmptyStage onCamera={onStartCamera} />}
        {mode === "camera" && (
          <div className="media-wrap">
            <video onLoadedMetadata={(event) => { if (event.currentTarget.videoHeight) setMediaAspect(event.currentTarget.videoWidth / event.currentTarget.videoHeight); }} ref={videoRef} autoPlay playsInline muted />
            {!cameraReady && <div className="camera-loading"><Camera size={24} /><span>Đang khởi động camera…</span></div>}
            <DetectionOverlay result={result} />
          </div>
        )}
      </div>
      {mode !== "empty" && (
        <div className="viewer-actions">
          <button className="secondary" onClick={onStartCamera}><Camera size={17} /> Camera</button>
          {mode === "camera" && (
            <button className={live ? "danger" : "secondary"} onClick={onToggleLive}>
              {live ? <CircleStop size={17} /> : <Wifi size={17} />}
              {live ? "Dừng phân tích" : "Tiếp tục phân tích"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
