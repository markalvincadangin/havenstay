import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders human-readable label for moved_out", () => {
    render(<StatusBadge>moved_out</StatusBadge>);
    expect(screen.getByRole("status", { name: /status: moved out/i })).toBeInTheDocument();
    expect(screen.getByText("Moved Out")).toBeInTheDocument();
  });

  it("renders Partial for partial billing status", () => {
    render(<StatusBadge>partial</StatusBadge>);
    expect(screen.getByText("Partial")).toBeInTheDocument();
  });

  it("renders Unavailable for room unavailable status", () => {
    render(<StatusBadge>unavailable</StatusBadge>);
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
  });
});
