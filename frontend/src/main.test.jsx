import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MainPage } from "./main.jsx";
import { detectionColor } from "./utils/detectionColors.js";

vi.mock("./api.js", () => ({
  analyzeImage: vi.fn(() => new Promise(() => {})),
  enrollFace: vi.fn(),
  getEnrolledFaces: vi.fn().mockResolvedValue({ names: [] }),
}));

describe("Frontend entry point", () => {
  beforeEach(() => {
    window.location.hash = "#/scan";
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("offers camera and upload entry points", () => {
    render(<MainPage />);
    expect(screen.getByText("Start camera")).toBeInTheDocument();
    expect(screen.getByText("Upload image")).toBeInTheDocument();
  });

  it("assigns a visibly different color to each configured object class", () => {
    const classes = ["person", "car", "backpack", "cell phone", "watch", "books"];
    const colors = classes.map((item) => detectionColor(item, classes));
    expect(new Set(colors).size).toBe(classes.length);
  });

  it("opens identity enrollment as a separate page", async () => {
    render(<MainPage />);
    fireEvent.click(screen.getByRole("button", { name: "Identity enrollment" }));
    expect(await screen.findByRole("heading", { name: "Enroll a known identity." })).toBeInTheDocument();
    expect(screen.getByText(/backend\/data\/people/)).toBeInTheDocument();
  });

  it("disables frame analysis and camera selection during live scan", async () => {
    const track = { stop: vi.fn(), getSettings: () => ({ deviceId: "camera-1" }) };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: vi.fn().mockResolvedValue([{ kind: "videoinput", deviceId: "camera-1", label: "Test camera" }]),
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [track],
          getVideoTracks: () => [track],
        }),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", { configurable: true, get: () => 640 });
    Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", { configurable: true, get: () => 480 });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() });
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(new Blob(["frame"], { type: "image/jpeg" })));

    render(<MainPage />);
    fireEvent.click(screen.getByRole("button", { name: "Start camera" }));
    const liveButton = await screen.findByRole("button", { name: "Live scan" });
    fireEvent.click(liveButton);

    await waitFor(() => expect(screen.getByRole("button", { name: "Stop live" })).toBeInTheDocument());
    expect(screen.getByLabelText("Chọn camera")).toBeDisabled();
    expect(screen.getByRole("button", { name: /Analyz/ })).toBeDisabled();
  });
});
