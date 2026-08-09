import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { analyzeImage } from "../api.js";
import CameraBox from "../components/CameraBox.jsx";
import Footer from "../components/Footer.jsx";
import Header from "../components/Header.jsx";
import ObservationSidebar from "../components/ObservationSidebar.jsx";
import { captureVideoFrame, getAvailableCameras } from "../utils/camera.js";

const INITIAL_CLASSES = "person, car, backpack, cell phone";

export default function ScanPage({ onNavigate }) {
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

  const people = result?.detections.filter((item) => item.label === "person").length || 0;
  const knownFaces = result?.faces.filter((face) => face.name !== "Unknown").length || 0;

  return (
    <main>
      <Header page="scan" onNavigate={onNavigate} />
      <section className="hero-copy">
        <div>
          <p className="eyebrow"><Sparkles size={14} /> DQ TECH</p>
          <h2>Recognize people and objects</h2>
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
          objectCount={result?.detections.length || 0}
          classes={classes}
          recognizeFaces={recognizeFaces}
          warnings={result?.warnings || []}
          error={error}
          onClassesChange={(event) => setClasses(event.target.value)}
          onRecognizeFacesChange={(event) => setRecognizeFaces(event.target.checked)}
        />
      </section>
      <Footer items={["YOLO-WORLD", "YUNET + SFACE ONNX", "CPU FACE TRACKING"]} />
    </main>
  );
}
