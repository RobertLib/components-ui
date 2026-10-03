import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import ImageViewer from "./image-viewer";

const images = [
  { src: "/one.png", alt: "First landscape", caption: "A mountain" },
  { src: "/two.png", alt: "Second landscape", caption: "A river" },
];

describe("ImageViewer", () => {
  it("starts closed and shows a named modal when opened", () => {
    const { rerender } = render(<ImageViewer images={images} title="Travel" />);
    expect(screen.queryByRole("dialog")).toBeNull();
    rerender(<ImageViewer images={images} open title="Travel" />);
    expect(screen.getByRole("dialog", { name: "Travel" })).toHaveAttribute(
      "aria-modal",
      "true",
    );
    expect(screen.getByText("A mountain")).toBeInTheDocument();
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
  });

  it("navigates, wraps and resets zoom for the next image", async () => {
    const user = userEvent.setup();
    const onIndexChange = vi.fn();
    render(
      <ImageViewer defaultOpen images={images} onIndexChange={onIndexChange} />,
    );
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByText("150%")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next image" }));
    expect(screen.getByText("A river")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByText("A mountain")).toBeInTheDocument();
    expect(onIndexChange.mock.calls.map(([index]) => index)).toEqual([1, 0]);
  });

  it("supports controlled index, boundaries and thumbnail navigation", async () => {
    const user = userEvent.setup();
    function Gallery() {
      const [index, setIndex] = useState(0);
      return (
        <ImageViewer
          images={images}
          index={index}
          loop={false}
          onIndexChange={setIndex}
          open
        />
      );
    }
    render(<Gallery />);
    expect(
      screen.getByRole("button", { name: "Previous image" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Second landscape" }));
    expect(screen.getByText("2 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next image" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Second landscape" }),
    ).toHaveAttribute("aria-pressed", "true");
    await user.keyboard("{Home}");
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
  });

  it("keeps a refused controlled navigation on the current image", async () => {
    const onIndexChange = vi.fn();
    render(
      <ImageViewer
        images={images}
        index={0}
        onIndexChange={onIndexChange}
        open
      />,
    );
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Next image" }));
    expect(onIndexChange).toHaveBeenCalledWith(1);
    expect(screen.getByText("A mountain")).toBeInTheDocument();
  });

  it("shows loading and failed image feedback and handles an empty gallery", () => {
    const { rerender } = render(<ImageViewer defaultOpen images={images} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    fireEvent.load(screen.getByRole("img", { name: "First landscape" }));
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.error(screen.getByRole("img", { name: "First landscape" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The image could not be loaded.",
    );
    rerender(<ImageViewer defaultOpen images={[]} />);
    expect(screen.getByText("No images")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeDisabled();
  });

  it("closes with Escape and restores the trigger focus", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    function Gallery() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open gallery</button>
          <ImageViewer
            images={images}
            onClose={onClose}
            onOpenChange={setOpen}
            open={open}
          />
        </>
      );
    }
    render(<Gallery />);
    const trigger = screen.getByRole("button", { name: "Open gallery" });
    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
