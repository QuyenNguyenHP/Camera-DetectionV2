import { Aperture, ScanFace, Users, WifiOff } from "lucide-react";
import { detectionColor } from "../utils/detectionColors.js";

export default function ObservationSidebar({
  people,
  knownFaces,
  objectCount,
  classes,
  recognizeFaces,
  warnings,
  error,
  onClassesChange,
  onRecognizeFacesChange,
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
        </div>
      </div>
      <div className="panel controls">
        <p className="panel-label">Detection controls</p>
        <label>
          Objects to find <span>comma separated</span>
          <textarea rows="3" value={classes} onChange={onClassesChange} />
        </label>
        <div className="class-color-list" aria-label="Object detection colors">
          {objectClasses.map((item, index) => (
            <span key={`${item}-${index}`} style={{ "--class-color": detectionColor(item, objectClasses) }}>
              <i />{item}
            </span>
          ))}
        </div>
        <label className="toggle-row">
          <div><b>Face recognition</b><span>Match against enrolled faces</span></div>
          <input type="checkbox" checked={recognizeFaces} onChange={onRecognizeFacesChange} />
        </label>
      </div>
      {warnings.map((warning) => <div className="message warning" key={warning}><WifiOff size={17}/>{warning}</div>)}
      {error && <div className="message error"><WifiOff size={17}/>{error}</div>}
    </aside>
  );
}
