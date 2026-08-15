import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { analyzeImage } from "../api.js";
import CameraBox from "../components/CameraBox.jsx";
import Footer from "../components/Footer.jsx";
import Header from "../components/Header.jsx";
import ObservationSidebar from "../components/ObservationSidebar.jsx";
import { captureVideoFrame, getAvailableCameras } from "../utils/camera.js";

const INITIAL_CLASSES = "person, car, backpack, cell phone";

export default function ScanPage({ user, onNavigate, onLogout }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const inFlight = useRef(false);
  const trackingSession = useRef("");
  const [mode, setMode] = useState("empty");
  const [imageUrl, setImageUrl] = useState("");
  const [classes, setClasses] = useState(INITIAL_CLASSES);
  const [detectObjects, setDetectObjects] = useState(true);
  const [recognizeFaces, setRecognizeFaces] = useState(true);
  const [detectGestures, setDetectGestures] = useState(true);
  const [controlHome, setControlHome] = useState(false);
  const [live, setLive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraVersion, setCameraVersion] = useState(0);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [result, setResult] = useState(null);
  const [homeNotification, setHomeNotification] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
        // The active stream remains usable if device enumeration is unavailable.
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
    if (mode !== "camera") throw new Error("Wait for the camera preview to appear");
    return captureVideoFrame(videoRef.current, 960, 0.9);
  }, [mode]);

  const scan = useCallback(async () => {
    if (inFlight.current || mode === "empty") return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const blob = await currentFrame();
      setResult(await analyzeImage(
        blob,
        classes,
        detectObjects,
        recognizeFaces,
        detectGestures,
        controlHome,
        mode === "camera" ? trackingSession.current : "",
      ));
    } catch (err) {
      setError(err.message);
      setLive(false);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [classes, controlHome, currentFrame, detectGestures, detectObjects, mode, recognizeFaces]);

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

  useEffect(() => {
    if (result?.homeControl?.status !== "executed") return undefined;
    setHomeNotification({
      action: result.homeControl.action,
      entityId: result.homeControl.entityId,
    });
    const timer = setTimeout(() => setHomeNotification(null), 3000);
    return () => clearTimeout(timer);
  }, [result]);

  const people = result?.detections?.filter((item) => item.label === "person").length || 0;
  const knownFaces = result?.faces?.filter((face) => face.name !== "Unknown").length || 0;

  return (
    <main>
      <Header page="scan" user={user} onNavigate={onNavigate} onLogout={onLogout} />
      <section className="hero-copy">
        <div>
          <p className="eyebrow"><Sparkles size={14} /> DQ TECH</p>
          <h2>Recognize people, objects and hand gestures</h2>
        </div>
        <p>A Product under the development of DQ TECH</p>
      </section>
      <section className="workspace">
        <CameraBox
          mode={mode}
          imageUrl={imageUrl}
          videoRef={videoRef}
          cameraReady={cameraReady}
          result={result}
          classes={classes}
          cameras={cameras}
          selectedCameraId={selectedCameraId}
          busy={busy}
          live={live}
          onStartCamera={startCamera}
          onChangeCamera={changeCamera}
          onUpload={selectFile}
          onScan={scan}
          onToggleLive={() => setLive(!live)}
        />
        <ObservationSidebar
          people={people}
          knownFaces={knownFaces}
          objectCount={result?.detections?.length || 0}
          handCount={result?.hands?.length || 0}
          classes={classes}
          detectObjects={detectObjects}
          recognizeFaces={recognizeFaces}
          detectGestures={detectGestures}
          controlHome={controlHome}
          homeNotification={homeNotification}
          warnings={result?.warnings || []}
          error={error}
          onClassesChange={(event) => setClasses(event.target.value)}
          onDetectObjectsChange={(event) => setDetectObjects(event.target.checked)}
          onRecognizeFacesChange={(event) => setRecognizeFaces(event.target.checked)}
          onDetectGesturesChange={(event) => setDetectGestures(event.target.checked)}
          onControlHomeChange={(event) => {
            const enabled = event.target.checked;
            setControlHome(enabled);
            if (enabled) setDetectGestures(true);
          }}
        />
      </section>
      <Footer items={["YOLO-WORLD", "YUNET + SFACE ONNX", "MEDIAPIPE GESTURES"]} />
    </main>
  );
}
