import { useCallback, useEffect, useRef, useState } from "react";
import {
  Aperture,
  Camera,
  CheckCircle2,
  CircleStop,
  Clock3,
  ImagePlus,
  ScanFace,
  ShieldCheck,
  Sparkles,
  UserRoundPlus,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { analyzeImage, enrollFace } from "./api.js";

const INITIAL_CLASSES = "person, car, backpack, cell phone";

async function getAvailableCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === "videoinput")
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `Camera ${index + 1}`,
    }));
}

function DetectionBox({ item, face = false }) {
  const { x, y, width, height } = item.box;
  const label = face
    ? `${item.name}${item.trackId ? ` · #${item.trackId}` : ""}`
    : `${item.label} ${Math.round(item.confidence * 100)}%`;
  return (
    <div
      className={`detection-box ${face ? "face-box" : ""}`}
      style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${width * 100}%`, height: `${height * 100}%` }}
    >
      <span>{label}</span>
    </div>
  );
}

function EmptyStage({ onCamera, onUpload }) {
  return (
    <div className="empty-state">
      <div className="scanner-mark"><ScanFace size={44} /></div>
      <p className="eyebrow">Ready to observe</p>
      <h2>Bring a scene into focus</h2>
      <p>Use your camera or choose a photo. Processing stays on your own services.</p>
      <div className="empty-actions">
        <button className="primary" onClick={onCamera}><Camera size={18} /> Start camera</button>
        <label className="button secondary"><ImagePlus size={18} /> Upload image<input type="file" accept="image/*" onChange={onUpload} /></label>
      </div>
    </div>
  );
}

export default function App() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const inFlight = useRef(false);
  const trackingSession = useRef("");
  const [mode, setMode] = useState("empty");
  const [imageUrl, setImageUrl] = useState("");
  const [classes, setClasses] = useState(INITIAL_CLASSES);
  const [recognizeFaces, setRecognizeFaces] = useState(true);
  const [live, setLive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraVersion, setCameraVersion] = useState(0);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
    setLive(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return undefined;

    const loadCameras = async () => {
      try {
        setCameras(await getAvailableCameras());
      } catch {
        // Một số trình duyệt chỉ cho liệt kê camera sau khi người dùng cấp quyền.
      }
    };

    loadCameras();
    navigator.mediaDevices.addEventListener?.("devicechange", loadCameras);
    return () => navigator.mediaDevices.removeEventListener?.("devicechange", loadCameras);
  }, []);

  useEffect(() => {
    if (mode !== "camera") return undefined;

    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return undefined;

    video.srcObject = stream;
    const playVideo = async () => {
      try {
        await video.play();
        setCameraReady(true);
      } catch (err) {
        setCameraReady(false);
        setError(`Không thể phát camera: ${err.message}`);
      }
    };

    video.addEventListener("loadedmetadata", playVideo);
    playVideo();

    return () => {
      video.removeEventListener("loadedmetadata", playVideo);
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [mode, cameraVersion]);

  const openCamera = async (deviceId = "") => {
    setError("");
    setCameraReady(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          window.isSecureContext
            ? "Trình duyệt này không hỗ trợ camera"
            : "Camera chỉ hoạt động trên localhost hoặc kết nối HTTPS",
        );
      }
      stopCamera();
      const videoConstraints = deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } };
      const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
      streamRef.current = stream;
      trackingSession.current = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

      const activeDeviceId = stream.getVideoTracks()[0]?.getSettings().deviceId || deviceId;
      try {
        setCameras(await getAvailableCameras());
      } catch {
        // Stream vẫn sử dụng được nếu trình duyệt không cho liệt kê thiết bị.
      }
      setSelectedCameraId(activeDeviceId || "");
      setCameraVersion((version) => version + 1);
      setMode("camera");
      setResult(null);
    } catch (err) {
      const messages = {
        NotAllowedError: "Bạn chưa cấp quyền sử dụng camera cho trình duyệt",
        NotFoundError: "Không tìm thấy camera trên thiết bị",
        NotReadableError: "Camera đang được ứng dụng khác sử dụng",
        OverconstrainedError: "Camera đã chọn không còn khả dụng",
      };
      setError(messages[err.name] || `Không thể mở camera: ${err.message}`);
    }
  };

  const startCamera = () => openCamera(selectedCameraId);

  const changeCamera = async (event) => {
    const deviceId = event.target.value;
    setSelectedCameraId(deviceId);
    if (mode === "camera") await openCamera(deviceId);
  };

  const selectFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    stopCamera();
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    fileRef.current = file;
    setImageUrl(URL.createObjectURL(file));
    setMode("image");
    setResult(null);
    setError("");
  };

  const currentFrame = useCallback(async () => {
    if (mode === "image" && fileRef.current) return fileRef.current;
    const video = videoRef.current;
    if (mode !== "camera" || !video?.videoWidth) throw new Error("Wait for the camera preview to appear");
    const canvas = document.createElement("canvas");
    // Giảm dữ liệu gửi lên backend nhưng giữ đủ chi tiết cho YuNet/SFace.
    // Việc này cải thiện đáng kể tốc độ trên CPU với camera 1080p/4K.
    const maxScanWidth = 960;
    const scale = Math.min(1, maxScanWidth / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not capture frame")), "image/jpeg", 0.9));
  }, [mode]);

  const scan = useCallback(async () => {
    if (inFlight.current || mode === "empty") return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const blob = await currentFrame();
      setResult(await analyzeImage(blob, classes, recognizeFaces, mode === "camera" ? trackingSession.current : ""));
    } catch (err) {
      setError(err.message);
      setLive(false);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [classes, currentFrame, mode, recognizeFaces]);

  useEffect(() => {
    if (!live || mode !== "camera") return undefined;
    let cancelled = false;
    let timer;

    const scanNextFrame = async () => {
      await scan();
      if (!cancelled) timer = setTimeout(scanNextFrame, 80);
    };

    scanNextFrame();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [live, mode, scan]);

  const enroll = async () => {
    if (!name.trim()) return setError("Enter the person's name first");
    setBusy(true);
    setError("");
    try {
      const payload = await enrollFace(await currentFrame(), name.trim());
      setNotice(payload.message);
      setName("");
      setTimeout(() => setNotice(""), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const people = result?.detections.filter((item) => item.label === "person").length || 0;
  const knownFaces = result?.faces.filter((face) => face.name !== "Unknown").length || 0;

  return (
    <main>
      <header>
        <div className="brand"><span><Aperture size={22} /></span><div>VISION <b>GUARD</b></div></div>
        <div className="status"><i /> Local vision stack <ShieldCheck size={17} /></div>
      </header>

      <section className="hero-copy">
        <div><p className="eyebrow"><Sparkles size={14} /> Open-vocabulary intelligence</p><h1>See what matters.<br/><em>Recognize who belongs.</em></h1></div>
        <p>YOLO-World object detection meets private, opt-in face recognition in one focused workspace.</p>
      </section>

      <section className="workspace">
        <div className="viewer-card">
          <div className="viewer-toolbar">
            <div><span className="live-dot" /> {mode === "camera" ? "CAMERA 01" : mode === "image" ? "UPLOADED FRAME" : "NO SOURCE"}</div>
            {result && <span><Clock3 size={14} /> {result.processingMs} ms</span>}
          </div>
          <div className="stage">
            {mode === "empty" && <EmptyStage onCamera={startCamera} onUpload={selectFile} />}
            {mode === "image" && <div className="media-wrap"><img src={imageUrl} alt="Scene to analyze" />
              <div className="overlay">{result?.detections.map((item, i) => <DetectionBox key={`d-${item.trackId ?? `${item.label}-${i}`}`} item={item} />)}{result?.faces.map((item, i) => <DetectionBox key={`f-${item.trackId ?? i}`} item={item} face />)}</div>
            </div>}
            {mode === "camera" && <div className="media-wrap"><video ref={videoRef} autoPlay playsInline muted />
              {!cameraReady && <div className="camera-loading"><Camera size={24} /><span>Đang khởi động camera…</span></div>}
              <div className="overlay">{result?.detections.map((item, i) => <DetectionBox key={`d-${item.trackId ?? `${item.label}-${i}`}`} item={item} />)}{result?.faces.map((item, i) => <DetectionBox key={`f-${item.trackId ?? i}`} item={item} face />)}</div>
            </div>}
          </div>
          {mode !== "empty" && <div className="viewer-actions">
            <button className="secondary" onClick={startCamera}><Camera size={17} /> Camera</button>
            <label className="camera-picker">
              <Camera size={15} />
              <select aria-label="Chọn camera" value={selectedCameraId} onChange={changeCamera} disabled={busy}>
                <option value="">Camera mặc định</option>
                {cameras.map((camera, index) => <option key={camera.deviceId || `camera-${index}`} value={camera.deviceId}>{camera.label}</option>)}
              </select>
            </label>
            <label className="button secondary"><ImagePlus size={17} /> Upload<input type="file" accept="image/*" onChange={selectFile} /></label>
            <button className="primary scan-button" disabled={busy} onClick={scan}><Aperture size={18} className={busy ? "spin" : ""} /> {busy ? "Analyzing…" : "Analyze frame"}</button>
            {mode === "camera" && <button className={live ? "danger" : "secondary"} onClick={() => setLive(!live)}>{live ? <CircleStop size={17} /> : <Wifi size={17} />}{live ? "Stop live" : "Live scan"}</button>}
          </div>}
        </div>

        <aside>
          <div className="panel metrics">
            <p className="panel-label">Current observation</p>
            <div className="metric-grid">
              <div><Users size={20}/><strong>{people}</strong><span>People</span></div>
              <div><ScanFace size={20}/><strong>{knownFaces}</strong><span>Recognized</span></div>
              <div><Aperture size={20}/><strong>{result?.detections.length || 0}</strong><span>Objects</span></div>
            </div>
          </div>

          <div className="panel controls">
            <p className="panel-label">Detection controls</p>
            <label>Objects to find <span>comma separated</span><textarea rows="3" value={classes} onChange={(e) => setClasses(e.target.value)} /></label>
            <label className="toggle-row"><div><b>Face recognition</b><span>Match against enrolled faces</span></div><input type="checkbox" checked={recognizeFaces} onChange={(e) => setRecognizeFaces(e.target.checked)} /></label>
          </div>

          <div className="panel enroll">
            <p className="panel-label">Identity enrollment</p>
            <div className="enroll-title"><UserRoundPlus size={22}/><div><b>Add a known face</b><span>Use a frame with one clear face</span></div></div>
            <input aria-label="Person name" placeholder="Person's name" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="secondary full" disabled={busy || mode === "empty"} onClick={enroll}>Enroll from current frame</button>
            <small>Only enroll people with their permission. Encodings are stored locally as JSON.</small>
          </div>

          {result?.warnings?.map((warning) => <div className="message warning" key={warning}><WifiOff size={17}/>{warning}</div>)}
          {error && <div className="message error"><WifiOff size={17}/>{error}</div>}
          {notice && <div className="message success"><CheckCircle2 size={17}/>{notice}</div>}
        </aside>
      </section>
      <footer><span>YOLO-WORLD</span><i /> <span>YUNET + SFACE ONNX</span><i /> <span>CPU FACE TRACKING</span></footer>
    </main>
  );
}
