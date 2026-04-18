import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "../../../src/app/_components/ui/StatusBadge";

describe("StatusBadge", () => {
  it("renders human-readable label for moved_out", () => {
    render(<StatusBadge>moved_out</StatusBadge>);
    expect(screen.getByRole("status", { name: /status: moved out/i })).toBeInTheDocument();
    expect(screen.getByText("Moved Out")).toBeInTheDocument();
  });

  it("renders Partial Payment for partial billing status", () => {
    render(<StatusBadge>partial</StatusBadge>);
    expect(screen.getByText("Partial Payment")).toBeInTheDocument();
  });

  it("renders Partially Occupied for room partially_occupied status", () => {
    render(<StatusBadge>partially_occupied</StatusBadge>);
    expect(screen.getByText("Partially Occupied")).toBeInTheDocument();
  });
});
