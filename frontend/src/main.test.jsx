import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

  it("offers camera without an image-upload entry point after authentication", async () => {
    render(<MainPage />);
    expect(await screen.findByText("Start camera")).toBeInTheDocument();
    expect(screen.queryByText("Upload image")).not.toBeInTheDocument();
  });

  it("displays one to four independent camera views and releases removed streams", async () => {
    analyzeImage.mockResolvedValue({ poses: [], faces: [], warnings: [], processingMs: 10,
      homeControl: { status: "idle" } });
    const tracks = [1, 2].map((id) => ({ stop: vi.fn(), getSettings: () => ({ deviceId: `camera-${id}` }) }));
    const getUserMedia = vi.fn().mockImplementation(async ({ video }) => {
      const track = tracks[video.deviceId?.exact === "camera-2" ? 1 : 0];
      return { getTracks: () => [track], getVideoTracks: () => [track] };
    });
    vi.stubGlobal("navigator", { mediaDevices: {
      enumerateDevices: vi.fn().mockResolvedValue(tracks.map((_, index) => ({
        kind: "videoinput", deviceId: `camera-${index + 1}`, label: `Device ${index + 1}`,
      }))),
      getUserMedia,
    } });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", { configurable: true, get: () => 640 });
    Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", { configurable: true, get: () => 480 });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() });
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(new Blob(["frame"], { type: "image/jpeg" })));
    render(<MainPage />);
    const count = await screen.findByLabelText("Number of cameras");
    for (const value of [2, 3, 4]) {
      fireEvent.change(count, { target: { value: String(value) } });
      expect(screen.getAllByRole("region", { name: /^Camera \d$/ })).toHaveLength(value);
      expect(screen.getAllByText("Cấu hình giám sát")).toHaveLength(1);
    }
    const first = within(screen.getByRole("region", { name: "Camera 1" }));
    const second = within(screen.getByRole("region", { name: "Camera 2" }));
    await second.findByRole("option", { name: "Device 2" });
    fireEvent.change(second.getByLabelText("Chọn camera"), { target: { value: "camera-2" } });
    fireEvent.click(first.getByRole("button", { name: "Start camera" }));
    await first.findByRole("button", { name: "Dừng phân tích" });
    await second.findByRole("button", { name: "Dừng phân tích" });
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({
      video: expect.objectContaining({ deviceId: { exact: "camera-2" } }),
    }));
    fireEvent.change(count, { target: { value: "1" } });
    expect(tracks[1].stop).toHaveBeenCalledOnce();
    expect(tracks[0].stop).not.toHaveBeenCalled();
    expect(first.getByRole("button", { name: "Dừng phân tích" })).toBeInTheDocument();
    cleanup();
    expect(tracks[0].stop).toHaveBeenCalledOnce();
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

  it("offers only face recognition and Home Assistant controls", async () => {
    render(<MainPage />);

    const faceToggle = await screen.findByLabelText("Enable face recognition");
    const homeToggle = screen.getByLabelText("Bật cảnh báo Home Assistant");
    expect(faceToggle).toBeChecked();
    expect(homeToggle).toBeChecked();

    fireEvent.click(faceToggle);
    expect(faceToggle).not.toBeChecked();
  });

  it("starts analysis automatically and shows a Home Assistant notification", async () => {
    const track = { stop: vi.fn(), getSettings: () => ({ deviceId: "camera-1" }) };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: vi.fn().mockResolvedValue([{ kind: "videoinput", deviceId: "camera-1", label: "Test camera" }]),
        getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track], getVideoTracks: () => [track] }),
        addEventListener: vi.fn(), removeEventListener: vi.fn(),
      },
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", { configurable: true, get: () => 640 });
    Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", { configurable: true, get: () => 480 });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() });
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(new Blob(["frame"], { type: "image/jpeg" })));
    analyzeImage.mockResolvedValueOnce({
      poses: [], faces: [], warnings: [], processingMs: 10,
      homeControl: {
        status: "executed",
        event: "vision_guard_fall",
        trackIds: [7],
      },
    });
    render(<MainPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Start camera" }));
    expect(await screen.findByRole("button", { name: "Dừng phân tích" })).toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent("vision_guard_fall");
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

  it("starts live analysis automatically and allows it to be paused", async () => {
    analyzeImage.mockResolvedValue({ poses: [], faces: [], warnings: [], processingMs: 10,
      homeControl: { status: "idle" } });
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
    const liveButton = await screen.findByRole("button", { name: "Dừng phân tích" });
    expect(screen.getByLabelText("Chọn camera")).toBeDisabled();
    fireEvent.click(liveButton);
    await waitFor(() => expect(screen.getByRole("button", { name: "Tiếp tục phân tích" })).toBeInTheDocument());
    expect(screen.getByLabelText("Chọn camera")).not.toBeDisabled();
  });
});
