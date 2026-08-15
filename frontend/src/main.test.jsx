import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeImage, getAuthStatus, getCurrentUser, loginUser } from "./api.js";
import { MainPage } from "./main.jsx";
import { detectionColor } from "./utils/detectionColors.js";

vi.mock("./api.js", () => ({
  getAuthStatus: vi.fn().mockResolvedValue({ setupRequired: false }),
  getCurrentUser: vi.fn(),
  loginUser: vi.fn(),
  logoutUser: vi.fn().mockResolvedValue({}),
  getUsers: vi.fn().mockResolvedValue({ users: [] }),
  createUser: vi.fn(),
  analyzeImage: vi.fn(() => new Promise(() => {})),
  enrollFace: vi.fn(),
  getEnrolledFaces: vi.fn().mockResolvedValue({ names: [] }),
}));

describe("Frontend entry point", () => {
  beforeEach(() => {
    window.location.hash = "#/scan";
    getCurrentUser.mockResolvedValue({ id: 1, username: "admin", role: "admin" });
    getAuthStatus.mockResolvedValue({ setupRequired: false });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("offers camera and upload entry points after authentication", async () => {
    render(<MainPage />);
    expect(await screen.findByText("Start camera")).toBeInTheDocument();
    expect(screen.getByText("Upload image")).toBeInTheDocument();
  });

  it("uses the login page as the main page when no session exists", async () => {
    const unauthorized = Object.assign(new Error("Authentication required"), { status: 401 });
    getCurrentUser.mockRejectedValueOnce(unauthorized);
    loginUser.mockResolvedValueOnce({ id: 2, username: "operator", role: "user" });
    render(<MainPage />);

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Username" }), { target: { value: "operator" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "a-secure-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Start camera")).toBeInTheDocument();
  });

  it("assigns a visibly different color to each configured object class", () => {
    const classes = ["person", "car", "backpack", "cell phone", "watch", "books"];
    const colors = classes.map((item) => detectionColor(item, classes));
    expect(new Set(colors).size).toBe(classes.length);
  });

  it("offers independent controls for objects, faces, and hand gestures", async () => {
    render(<MainPage />);

    const objectToggle = await screen.findByLabelText("Enable object detection");
    const faceToggle = screen.getByLabelText("Enable face recognition");
    const gestureToggle = screen.getByLabelText("Enable hand gesture detection");
    const homeToggle = screen.getByLabelText("Bật điều khiển nhà qua cử chỉ");
    expect(objectToggle).toBeChecked();
    expect(faceToggle).toBeChecked();
    expect(gestureToggle).toBeChecked();
    expect(homeToggle).not.toBeChecked();

    fireEvent.click(objectToggle);
    fireEvent.click(faceToggle);
    fireEvent.click(gestureToggle);
    expect(objectToggle).not.toBeChecked();
    expect(faceToggle).not.toBeChecked();
    expect(gestureToggle).not.toBeChecked();
  });

  it("shows a Home Assistant action notification for three seconds", async () => {
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:test-frame"),
      revokeObjectURL: vi.fn(),
    });
    analyzeImage.mockResolvedValueOnce({
      detections: [], faces: [], hands: [], warnings: [], processingMs: 10,
      homeControl: {
        status: "executed",
        action: "switch.turn_on",
        entityId: "switch.t1_chieu_sang_switch_3",
      },
    });
    render(<MainPage />);

    fireEvent.click(await screen.findByLabelText("Bật điều khiển nhà qua cử chỉ"));
    const file = new File(["frame"], "frame.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("Upload image"), { target: { files: [file] } });
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Analyze frame" }));

    await act(async () => {});
    expect(screen.getByRole("status")).toHaveTextContent("switch.turn_on");
    await act(() => vi.advanceTimersByTimeAsync(2999));
    expect(screen.getByRole("status")).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("opens identity enrollment and user management for an admin", async () => {
    render(<MainPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Identity enrollment" }));
    expect(await screen.findByRole("heading", { name: "Enroll a known identity." })).toBeInTheDocument();
    expect(screen.getByText(/backend\/data\/people/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Add application user" })).toBeInTheDocument();
  });

  it("does not allow a normal user to open enrollment", async () => {
    window.location.hash = "#/enrollment";
    getCurrentUser.mockResolvedValueOnce({ id: 2, username: "operator", role: "user" });
    render(<MainPage />);

    expect(await screen.findByText("Start camera")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Identity enrollment" })).not.toBeInTheDocument();
    expect(window.location.hash).toBe("#/scan");
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
    fireEvent.click(await screen.findByRole("button", { name: "Start camera" }));
    const liveButton = await screen.findByRole("button", { name: "Live scan" });
    fireEvent.click(liveButton);

    await waitFor(() => expect(screen.getByRole("button", { name: "Stop live" })).toBeInTheDocument());
    expect(screen.getByLabelText("Chọn camera")).toBeDisabled();
    expect(screen.getByRole("button", { name: /Analyz/ })).toBeDisabled();
  });
});
