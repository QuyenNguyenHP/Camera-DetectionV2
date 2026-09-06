import { Aperture, Hand, ScanFace, Users, WifiOff } from "lucide-react";
import { detectionColor } from "../utils/detectionColors.js";

export default function ObservationSidebar({
  people,
  knownFaces,
  objectCount,
  handCount,
  classes,
  detectDrowsiness,
  onDetectDrowsinessChange,
  drowsiness,
  detectSmoking,
  smokingCount,
  onDetectSmokingChange,
  detectPoses,
  onDetectPosesChange,
  detectObjects,
  recognizeFaces,
  detectGestures,
  controlHome,
  homeNotification,
  warnings,
  error,
  onClassesChange,
  onDetectObjectsChange,
  onRecognizeFacesChange,
  onDetectGesturesChange,
  onControlHomeChange,
}) {
  const objectClasses = classes
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <aside>
      <div className="panel metrics">
        <p className="panel-label">Current observation</p>
        <div className="metric-grid">
          <div><Users size={20}/><strong>{people}</strong><span>People</span></div>
          <div><ScanFace size={20}/><strong>{knownFaces}</strong><span>Recognized</span></div>
          <div><Aperture size={20}/><strong>{objectCount}</strong><span>Objects</span></div>
          <div><Hand size={20}/><strong>{handCount}</strong><span>Hands</span></div>
        </div>
      </div>
      <div className="panel controls">
        <p className="panel-label">Detection controls</p>
        <label>
          Objects to find <span>comma separated</span>
          <textarea rows="3" value={classes} onChange={onClassesChange} disabled={!detectObjects} />
        </label>
        <div className="class-color-list" aria-label="Object detection colors">
          {objectClasses.map((item, index) => (
            <span key={`${item}-${index}`} style={{ "--class-color": detectionColor(item, objectClasses) }}>
              <i />{item}
            </span>
          ))}
        </div>
        <label className="toggle-row">
          <div><b>Theo dõi buồn ngủ</b><span>Theo dõi mắt khi bật Live scan</span></div>
          <input aria-label="Theo dõi buồn ngủ" type="checkbox" checked={detectDrowsiness} onChange={onDetectDrowsinessChange} />
        </label>
        {detectDrowsiness && <div role={drowsiness?.alert ? "alert" : "status"} className={`message ${drowsiness?.alert ? "error" : "warning"}`}>
          <div><b>{drowsiness?.alert ? "Cảnh báo: nghi buồn ngủ" : drowsiness?.status === "eyes_open" ? "Mắt đang mở" : drowsiness?.status === "eyes_closed" ? "Mắt đang nhắm" : "Không đủ dữ liệu"}</b>
          <p>{drowsiness?.message || "Bật Live scan và nhìn vào camera. Đây là tính năng thử nghiệm."}</p>
          {drowsiness?.closedSeconds != null && <p>Nhắm mắt liên tục: {drowsiness.closedSeconds} giây</p>}</div>
        </div>}
        <label className="toggle-row">
          <div><b>Phát hiện khói thuốc</b><span>Phát hiện dấu hiệu khói bằng model riêng</span></div>
          <input aria-label="Phát hiện khói thuốc" type="checkbox" checked={detectSmoking} onChange={onDetectSmokingChange} />
        </label>
        {detectSmoking && <div className="message warning" role="status">Phát hiện: {smokingCount} vùng khói. Không đủ để kết luận một người đang hút thuốc.</div>}
        <label className="toggle-row">
          <div><b>Body pose</b><span>Show body keypoints and skeletons</span></div>
          <input aria-label="Enable body pose detection" type="checkbox" checked={detectPoses} onChange={onDetectPosesChange} />
        </label>
        <label className="toggle-row">
          <div><b>Object detection</b><span>Detect configured object classes</span></div>
          <input aria-label="Enable object detection" type="checkbox" checked={detectObjects} onChange={onDetectObjectsChange} />
        </label>
        <label className="toggle-row">
          <div><b>Face recognition</b><span>Match against enrolled faces</span></div>
          <input aria-label="Enable face recognition" type="checkbox" checked={recognizeFaces} onChange={onRecognizeFacesChange} />
        </label>
        <label className="toggle-row">
          <div><b>Hand gesture detection</b><span>Recognize hand poses with MediaPipe</span></div>
          <input aria-label="Enable hand gesture detection" type="checkbox" checked={detectGestures} onChange={onDetectGesturesChange} />
        </label>
        <label className="toggle-row">
          <div><b>Điều khiển nhà qua cử chỉ</b><span>Gửi thao tác đến Home Assistant</span></div>
          <input aria-label="Bật điều khiển nhà qua cử chỉ" type="checkbox" checked={controlHome} onChange={onControlHomeChange} />
        </label>
        {controlHome && homeNotification && (
          <div className="home-control-status" role="status">
            Đã thực hiện {homeNotification.action} cho {homeNotification.entityId}
          </div>
        )}
      </div>
      {warnings.map((warning) => <div className="message warning" key={warning}><WifiOff size={17}/>{warning}</div>)}
      {error && <div className="message error"><WifiOff size={17}/>{error}</div>}
    </aside>
  );
}
