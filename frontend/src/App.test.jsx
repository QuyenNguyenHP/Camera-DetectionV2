import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App.jsx";

describe("App", () => {
  it("offers camera and upload entry points", () => {
    render(<App />);
    expect(screen.getByText("Start camera")).toBeInTheDocument();
    expect(screen.getByText("Upload image")).toBeInTheDocument();
  });
});

