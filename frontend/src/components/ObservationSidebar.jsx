import { ScanFace, ShieldAlert, Users, WifiOff } from "lucide-react";

export default function ObservationSidebar({
  people, knownFaces, fallCount, recognizeFaces, notifyHome,
  homeNotification, warnings, error, onRecognizeFacesChange, onNotifyHomeChange,
}) {
  return (
    <aside>
      <div className="panel metrics">
        <p className="panel-label">Giám sát hiện tại</p>
        <div className="metric-grid">
          <div><Users size={20}/><strong>{people}</strong><span>Người</span></div>
          <div><ScanFace size={20}/><strong>{knownFaces}</strong><span>Đã nhận diện</span></div>
          <div><ShieldAlert size={20}/><strong>{fallCount}</strong><span>Cảnh báo ngã</span></div>
        </div>
      </div>
      <div className="panel controls">
        <p className="panel-label">Cấu hình giám sát</p>
        <label className="toggle-row">
          <div><b>Nhận diện khuôn mặt</b><span>So khớp với khuôn mặt đã đăng ký</span></div>
          <input aria-label="Enable face recognition" type="checkbox" checked={recognizeFaces} onChange={onRecognizeFacesChange} />
        </label>
        <label className="toggle-row">
          <div><b>Cảnh báo Home Assistant</b><span>Gửi sự kiện khi ngã được xác nhận qua nhiều khung hình</span></div>
          <input aria-label="Bật cảnh báo Home Assistant" type="checkbox" checked={notifyHome} onChange={onNotifyHomeChange} />
        </label>
        {homeNotification && <div className="home-control-status" role="status">
          Camera {homeNotification.cameraNumber}: đã gửi sự kiện {homeNotification.event}
          {" "}cho track #{homeNotification.trackIds.join(", #")}
        </div>}
      </div>
      {warnings.map((warning) => <div className="message warning" key={warning}><WifiOff size={17}/>{warning}</div>)}
      {error && <div className="message error"><WifiOff size={17}/>{error}</div>}
    </aside>
  );
}
