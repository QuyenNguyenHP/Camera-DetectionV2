import { useCallback, useEffect, useRef, useState } from "react";
import { UserRoundPlus } from "lucide-react";
import { enrollFace, getEnrolledFaces } from "../api.js";
import EnrollmentCameraBox from "../components/EnrollmentCameraBox.jsx";
import EnrollmentSidebar from "../components/EnrollmentSidebar.jsx";
import Footer from "../components/Footer.jsx";
import Header from "../components/Header.jsx";
import { captureVideoFrame } from "../utils/camera.js";

export default function EnrollmentPage({ onNavigate }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const [source, setSource] = useState("empty");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraVersion, setCameraVersion] = useState(0);
  const [imageUrl, setImageUrl] = useState("");
  const [name, setName] = useState("");
  const [names, setNames] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);
  useEffect(() => () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);
  useEffect(() => {
    getEnrolledFaces().then((payload) => setNames(payload.names || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (source !== "camera" || !videoRef.current || !streamRef.current) return undefined;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    const play = async () => {
      try {
        await video.play();
        setCameraReady(true);
      } catch (err) {
        setError(`Could not show camera: ${err.message}`);
      }
    };
    video.addEventListener("loadedmetadata", play);
    play();
    return () => video.removeEventListener("loadedmetadata", play);
  }, [source, cameraVersion]);

  const openCamera = async () => {
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera is not available in this browser");
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "user" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      fileRef.current = null;
      setSource("camera");
      setCameraVersion((version) => version + 1);
    } catch (err) {
      setError(`Could not open camera: ${err.message}`);
    }
  };

  const selectFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    stopCamera();
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    fileRef.current = file;
    setImageUrl(URL.createObjectURL(file));
    setSource("image");
    setError("");
    setNotice("");
  };

  const currentEnrollmentFrame = async () => {
    if (source === "image" && fileRef.current) return fileRef.current;
    if (source !== "camera") throw new Error("Wait for the camera preview to appear");
    return captureVideoFrame(videoRef.current, undefined, 0.95);
  };

  const enroll = async () => {
    if (!name.trim()) return setError("Enter the person's name first");
    if (source === "empty") return setError("Choose a photo or start the camera first");
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = await enrollFace(await currentEnrollmentFrame(), name.trim());
      setNotice(`${payload.message}. The enrollment photo was saved in the people folder.`);
      setNames(payload.names || []);
      setName("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main>
      <Header page="enrollment" onNavigate={onNavigate} />
      <section className="enrollment-hero">
        <p className="eyebrow"><UserRoundPlus size={14} /> Private identity registry</p>
        <h1>Enroll a known identity.</h1>
        <p>Use one clear, front-facing photo. Only enroll people who have given permission.</p>
      </section>
      <section className="enrollment-workspace">
        <EnrollmentCameraBox
          source={source}
          imageUrl={imageUrl}
          videoRef={videoRef}
          cameraReady={cameraReady}
          busy={busy}
          onStartCamera={openCamera}
          onUpload={selectFile}
        />
        <EnrollmentSidebar
          name={name}
          names={names}
          source={source}
          busy={busy}
          error={error}
          notice={notice}
          onNameChange={(event) => setName(event.target.value)}
          onEnroll={enroll}
        />
      </section>
      <Footer items={["LOCAL IDENTITY STORE", "CONSENT-BASED ENROLLMENT"]} />
    </main>
  );
}
