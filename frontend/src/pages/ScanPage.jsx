import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { analyzeImage } from "../api.js";
import CameraBox from "../components/CameraBox.jsx";
import Footer from "../components/Footer.jsx";
import Header from "../components/Header.jsx";
import ObservationSidebar from "../components/ObservationSidebar.jsx";
import { captureVideoFrame, getAvailableCameras } from "../utils/camera.js";

function CameraWorkspace({ cameraNumber, recognizeFaces, notifyHome, onObservation, onHomeNotification }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const cameraRequest = useRef(0);
  const inFlight = useRef(false);
  const trackingSession = useRef("");
  const [mode, setMode] = useState("empty");
  const [live, setLive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraVersion, setCameraVersion] = useState(0);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const stopCamera = useCallback(() => {
    cameraRequest.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
    setLive(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);
  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return undefined;
    const loadCameras = async () => {
      try {
        setCameras(await getAvailableCameras());
      } catch {
        // Some browsers only expose devices after camera permission is granted.
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
        setLive(true);
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
        throw new Error(window.isSecureContext
          ? "Trình duyệt này không hỗ trợ camera"
          : "Camera chỉ hoạt động trên localhost hoặc kết nối HTTPS");
      }
      stopCamera();
      const request = cameraRequest.current;
      const videoConstraints = deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } };
      const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
      if (request !== cameraRequest.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      trackingSession.current = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

      const activeDeviceId = stream.getVideoTracks()[0]?.getSettings().deviceId || deviceId;
      try {
        setCameras(await getAvailableCameras());
      } catch {
        // The active stream remains usable if device enumeration is unavailable.
      }
      if (request !== cameraRequest.current) return;
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
    await openCamera(deviceId);
  };

  const currentFrame = useCallback(async () => {
    if (!streamRef.current || !videoRef.current) return null;
    return captureVideoFrame(videoRef.current, 960, 0.9);
  }, []);

  const scan = useCallback(async () => {
    if (inFlight.current || mode === "empty") return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const blob = await currentFrame();
      if (!blob) return;
      setResult(await analyzeImage(
        blob,
        recognizeFaces,
        notifyHome,
        trackingSession.current,
      ));
    } catch (err) {
      setError(err.message);
      setLive(false);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [currentFrame, mode, notifyHome, recognizeFaces]);

  useEffect(() => {
    if (!live || mode !== "camera" || !cameraReady) return undefined;
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
  }, [cameraReady, live, mode, scan]);

  useEffect(() => {
    if (result?.homeControl?.status !== "executed") return undefined;
    onHomeNotification({
      cameraNumber,
      event: result.homeControl.event,
      trackIds: result.homeControl.trackIds,
    });
  }, [cameraNumber, onHomeNotification, result]);

  useEffect(() => {
    onObservation(cameraNumber, { result, error });
  }, [cameraNumber, error, onObservation, result]);

  useEffect(() => () => onObservation(cameraNumber, null), [cameraNumber, onObservation]);

  return (
      <section className="camera-workspace" aria-label={`Camera ${cameraNumber}`}>
        <CameraBox
          cameraNumber={cameraNumber}
          mode={mode}
          videoRef={videoRef}
          cameraReady={cameraReady}
          result={result}
          cameras={cameras}
          selectedCameraId={selectedCameraId}
          busy={busy}
          live={live}
          onStartCamera={startCamera}
          onChangeCamera={changeCamera}
          onToggleLive={() => setLive(!live)}
        />
      </section>

  );
}

export default function ScanPage({ user, onNavigate, onLogout }) {
  const [cameraCount, setCameraCount] = useState(1);
  const [recognizeFaces, setRecognizeFaces] = useState(true);
  const [notifyHome, setNotifyHome] = useState(true);
  const [observations, setObservations] = useState({});
  const [homeNotification, setHomeNotification] = useState(null);

  const updateObservation = useCallback((cameraNumber, observation) => {
    setObservations((current) => {
      if (observation === null) {
        const next = { ...current };
        delete next[cameraNumber];
        return next;
      }
      return { ...current, [cameraNumber]: observation };
    });
  }, []);

  const showHomeNotification = useCallback((notification) => {
    setHomeNotification(notification);
  }, []);

  useEffect(() => {
    if (!homeNotification) return undefined;
    const timer = setTimeout(() => setHomeNotification(null), 3000);
    return () => clearTimeout(timer);
  }, [homeNotification]);

  const activeObservations = Object.entries(observations)
    .filter(([cameraNumber]) => Number(cameraNumber) <= cameraCount)
    .map(([cameraNumber, observation]) => ({ cameraNumber, ...observation }));
  const people = activeObservations.reduce((total, item) => total + (item.result?.poses?.length || 0), 0);
  const knownFaces = activeObservations.reduce((total, item) => total
    + (item.result?.faces?.filter((face) => face.name !== "Unknown").length || 0), 0);
  const fallCount = activeObservations.reduce((total, item) => total
    + (item.result?.poses?.filter((pose) => pose.fall?.alert).length || 0), 0);
  const warnings = activeObservations.flatMap((item) =>
    (item.result?.warnings || []).map((warning) => `Camera ${item.cameraNumber}: ${warning}`));
  const errors = activeObservations.map((item) => item.error && `Camera ${item.cameraNumber}: ${item.error}`).filter(Boolean);

  return (
    <main>
      <Header page="scan" user={user} onNavigate={onNavigate} onLogout={onLogout} />
      <section className="hero-copy">
        <div>
          <p className="eyebrow"><Sparkles size={14} /> DQ TECH</p>
          <h2>Phát hiện người bị ngã và nhận diện khuôn mặt</h2>
        </div>
        <p>A Product under the development of DQ TECH</p>
      </section>
      <div className="camera-layout-controls">
        <label className="camera-picker">
          Display
          <select aria-label="Number of cameras" value={cameraCount}
            onChange={(event) => setCameraCount(Number(event.target.value))}>
            {[1, 2, 3, 4].map((count) => (
              <option key={count} value={count}>{count} {count === 1 ? "camera" : "cameras"}</option>
            ))}
          </select>
        </label>
        <span>Chọn thiết bị; phân tích sẽ tự động bắt đầu khi camera sẵn sàng.</span>
      </div>
      <div className="monitoring-layout">
        <div className={`camera-grid${cameraCount > 1 ? " camera-grid-multiple" : ""}`}>
          {Array.from({ length: cameraCount }, (_, index) => (
            <CameraWorkspace key={index} cameraNumber={index + 1}
              recognizeFaces={recognizeFaces} notifyHome={notifyHome}
              onObservation={updateObservation} onHomeNotification={showHomeNotification} />
          ))}
        </div>
        <ObservationSidebar
          people={people}
          knownFaces={knownFaces}
          fallCount={fallCount}
          recognizeFaces={recognizeFaces}
          notifyHome={notifyHome}
          homeNotification={homeNotification}
          warnings={warnings}
          error={errors.join(" · ")}
          onRecognizeFacesChange={(event) => setRecognizeFaces(event.target.checked)}
          onNotifyHomeChange={(event) => setNotifyHome(event.target.checked)}
        />
      </div>
      <Footer items={["CPU ONLY", "YOLO POSE", "YUNET + SFACE ONNX", "HOME ASSISTANT"]} />
    </main>
  );
}
