import { useState } from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PlaceholderPicker } from "../components/PlaceholderPicker";
import { ImagePicker } from "../components/ImagePicker";
import { BUILTIN_PLACEHOLDERS } from "../plugin/placeholders";
import { HEAD_FALLBACK_MATERIALS } from "../plugin/images";

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

/** A parent that owns the value, the way PropertiesPanel does. */
function ControlledImagePicker({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <ImagePicker value={value} onChange={setValue} />;
}

describe("ImagePicker", () => {
  it("reports the kind of an image value as the contract classifies it", () => {
    render(<ImagePicker value="head:Notch" onChange={vi.fn()} />);
    expect(screen.getByText(/player head/i)).toBeInTheDocument();
  });

  it("warns only on an unclassifiable image", () => {
    const { rerender } = render(<ImagePicker value="DIAMOND_SWORD" onChange={vi.fn()} />);
    expect(screen.queryByRole("alert")).toBeNull();
    rerender(<ImagePicker value="not a real thing" onChange={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/unrecognised image source/i);
  });

  it("stays quiet on an empty value", () => {
    render(<ImagePicker value="" onChange={vi.fn()} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says nothing while a valid URL is still half-typed", () => {
    // `https:` and `https:/` are both unclassifiable, and the diagnosis is a live region:
    // announcing "unrecognised" mid-word at every keystroke is worse than saying nothing.
    render(<ControlledImagePicker />);
    const input = screen.getByLabelText("Image");
    for (const draft of ["h", "https:", "https:/", "https://example.com/i.pn"]) {
      fireEvent.change(input, { target: { value: draft } });
      expect(screen.queryByRole("alert"), draft).toBeNull();
    }
  });

  it("diagnoses the value once it is committed", () => {
    render(<ControlledImagePicker />);
    const input = screen.getByLabelText("Image");
    fireEvent.change(input, { target: { value: "not a real thing" } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.blur(input);
    expect(screen.getByRole("alert")).toHaveTextContent(/unrecognised image source/i);
  });

  it("never offers a head-fallback material as a source to pick", () => {
    render(<ImagePicker value="" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /image sources/i }));
    expect(screen.getByText("In-game item")).toBeInTheDocument();
    for (const material of HEAD_FALLBACK_MATERIALS) {
      expect(screen.queryByText(material), material).toBeNull();
    }
    expect(document.querySelector('[data-image-kind="headFallback"]')).toBeNull();
  });

  it("warns that a head-fallback material renders as a player head", () => {
    render(<ImagePicker value="BARRIER" onChange={vi.fn()} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/player head named .BARRIER./);
    expect(alert).not.toHaveTextContent(/no icon at all|draws nothing/i);
  });

  it("gives the source-list toggle a name that is not the emoji", () => {
    render(<ImagePicker value="" onChange={vi.fn()} />);
    const toggle = screen.getByRole("button", { name: "Image sources" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
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
