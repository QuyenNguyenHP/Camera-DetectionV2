import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import PoseOverlay from "./PoseOverlay.jsx";
afterEach(cleanup);
it("only connects visible keypoints", () => {
  const points = Array.from({ length: 17 }, () => ({ x: 0.5, y: 0.5, confidence: 0.1 }));
  points[5].confidence = 0.9;
  points[6].confidence = 0.9;
  const { container } = render(<PoseOverlay poses={[{ keypoints: points }]} />);
  expect(container.querySelectorAll("circle")).toHaveLength(2);
  expect(container.querySelectorAll("line")).toHaveLength(1);
});
