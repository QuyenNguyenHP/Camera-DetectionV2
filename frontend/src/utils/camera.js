export async function getAvailableCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === "videoinput")
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `Camera ${index + 1}`,
    }));
}

export function captureVideoFrame(video, maxWidth, quality = 0.9) {
  if (!video?.videoWidth) throw new Error("Wait for the camera preview to appear");
  const scale = maxWidth ? Math.min(1, maxWidth / video.videoWidth) : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("Could not capture frame")),
    "image/jpeg",
    quality,
  ));
}
