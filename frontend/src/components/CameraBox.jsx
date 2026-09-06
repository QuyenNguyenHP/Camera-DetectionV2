import { useState } from "react";
import { Aperture, Camera, CircleStop, Clock3, ImagePlus, Wifi } from "lucide-react";
import EyeOverlay from "./EyeOverlay.jsx";
import PoseOverlay from "./PoseOverlay.jsx";
import DetectionBox from "./DetectionBox.jsx";
import EmptyStage from "./EmptyStage.jsx";

function DetectionOverlay({ result, objectClasses, detectDrowsiness, detectSmoking }) {
  return (
    <div className="overlay">
      {detectDrowsiness && <EyeOverlay eyes={result?.drowsiness?.eyes} />}
      <PoseOverlay poses={result?.poses} />
      {detectSmoking && result?.smoking?.map((item, index) => (
        <DetectionBox key={`smoking-${index}`} item={item} objectClasses={["cigarette", "smoking"]} />
      ))}
      {result?.poses?.map((pose, index) => <DetectionBox key={`pose-${index}`} item={pose} objectClasses={objectClasses} />)}
      {result?.detections?.map((item, index) => (
        <DetectionBox key={`d-${item.trackId ?? `${item.label}-${index}`}`} item={item} objectClasses={objectClasses} />
      ))}
      {result?.faces?.map((item, index) => (
        <DetectionBox key={`f-${item.trackId ?? index}`} item={item} face />
      ))}
      {result?.hands?.map((item, index) => (
        <DetectionBox key={`h-${index}`} item={item} hand />
      ))}
    </div>
  );
}

export default function CameraBox({
  cameraNumber = 1,
  detectDrowsiness = false,
  detectSmoking = false,
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
  const [mediaAspect, setMediaAspect] = useState(16 / 9);
  const sourceLabel = mode === "camera" ? `CAMERA ${String(cameraNumber).padStart(2, "0")}` : mode === "image" ? "UPLOADED FRAME" : `CAMERA ${String(cameraNumber).padStart(2, "0")} · NO SOURCE`;
  const objectClasses = classes.split(",").map((item) => item.trim()).filter(Boolean);

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
        {mode === "empty" && <EmptyStage onCamera={onStartCamera} onUpload={onUpload} />}
        {mode === "image" && (
          <div className="media-wrap">
            <img onLoad={(event) => setMediaAspect(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight)} src={imageUrl} alt="Scene to analyze" />
            <DetectionOverlay detectDrowsiness={detectDrowsiness} detectSmoking={detectSmoking} result={result} objectClasses={objectClasses} />
          </div>
        )}
        {mode === "camera" && (
          <div className="media-wrap">
            <video onLoadedMetadata={(event) => { if (event.currentTarget.videoHeight) setMediaAspect(event.currentTarget.videoWidth / event.currentTarget.videoHeight); }} ref={videoRef} autoPlay playsInline muted />
            {!cameraReady && <div className="camera-loading"><Camera size={24} /><span>Đang khởi động camera…</span></div>}
            <DetectionOverlay detectDrowsiness={detectDrowsiness} detectSmoking={detectSmoking} result={result} objectClasses={objectClasses} />
          </div>
        )}
      </div>
      {mode !== "empty" && (
        <div className="viewer-actions">
          <button className="secondary" onClick={onStartCamera}><Camera size={17} /> Camera</button>
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
