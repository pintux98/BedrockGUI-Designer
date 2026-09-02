import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PlaceholderPicker } from "../components/PlaceholderPicker";
import { ImagePicker } from "../components/ImagePicker";
import { BUILTIN_PLACEHOLDERS } from "../plugin/placeholders";

afterEach(() => cleanup());

describe("PlaceholderPicker", () => {
  it("offers exactly the contract's built-in placeholders", () => {
    render(<PlaceholderPicker onSelect={vi.fn()} />);
    for (const p of BUILTIN_PLACEHOLDERS) {
      expect(screen.getByText(p.token)).toBeInTheDocument();
    }
    expect(screen.queryByText("{money}")).toBeNull();
  });

  it("marks the Paper-only placeholders", () => {
    render(<PlaceholderPicker onSelect={vi.fn()} />);
    const health = screen.getByText("{health}").closest("[data-placeholder]")!;
    expect(health).toHaveAttribute("data-paper-only", "true");
    const player = screen.getByText("{player}").closest("[data-placeholder]")!;
    expect(player).toHaveAttribute("data-paper-only", "false");
  });

  it("hands the exact token to onSelect, with no onClose supplied", () => {
    const onSelect = vi.fn();
    const escaped: unknown[] = [];
    const trap = (e: ErrorEvent) => { escaped.push(e.error); e.preventDefault(); };
    window.addEventListener("error", trap);
    try {
      render(<PlaceholderPicker onSelect={onSelect} />);
      fireEvent.click(screen.getByText("{health}"));
    } finally {
      window.removeEventListener("error", trap);
    }
    expect(escaped).toEqual([]);
    expect(onSelect).toHaveBeenCalledWith("{health}");
  });

  it("still offers the positional arguments the contract does not carry", () => {
    render(<PlaceholderPicker onSelect={vi.fn()} />);
    for (const token of ["$1", "$2", "$3"]) {
      expect(screen.getByText(token).closest("[data-placeholder]")).toBeInTheDocument();
    }
  });
});

describe("ImagePicker", () => {
  it("reports the kind of an image value as the contract classifies it", () => {
    render(<ImagePicker value="head:Notch" onChange={vi.fn()} />);
    expect(screen.getByText(/player head/i)).toBeInTheDocument();
  });

  it("warns only on an unclassifiable image", () => {
    const { rerender } = render(<ImagePicker value="DIAMOND_SWORD" onChange={vi.fn()} />);
    expect(screen.queryByRole("alert")).toBeNull();
    rerender(<ImagePicker value="not a real thing" onChange={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("stays quiet on an empty value", () => {
    render(<ImagePicker value="" onChange={vi.fn()} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("$value", () => {
  it("offers $value, which the plugin sets for a component's own action", () => {
    render(<PlaceholderPicker onSelect={vi.fn()} />);
    expect(screen.getByText("$value")).toBeInTheDocument();
  });

  it("inserts $value verbatim when picked", () => {
    const onSelect = vi.fn();
    render(<PlaceholderPicker onSelect={onSelect} />);
    fireEvent.click(screen.getByText("$value"));
    expect(onSelect).toHaveBeenCalledWith("$value");
  });
});
