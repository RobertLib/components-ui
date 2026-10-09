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

  it("navigates when focus stays in the dialog header, including Safari pointer behavior", () => {
    const key = vi.fn();
    render(
      <ImageViewer
        defaultOpen
        defaultIndex={1}
        images={images}
        onKeyDown={key}
      />,
    );
    const close = screen.getByRole("button", { name: "Close dialog" });
    close.focus();
    fireEvent.keyDown(close, { key: "Home" });
    expect(screen.getByText("A mountain")).toBeInTheDocument();
    expect(key).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(close, { key: "End" });
    expect(screen.getByText("A river")).toBeInTheDocument();
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

  it("goes on past the loaded images of a longer gallery as they load", async () => {
    const user = userEvent.setup();
    const page = (from: number) =>
      [from, from + 1].map((number) => ({
        alt: `Photo ${number}`,
        src: `/photo-${number}.png`,
      }));

    function Gallery() {
      const [loaded, setLoaded] = useState(page(1));
      const [loading, setLoading] = useState<(() => void) | null>(null);
      return (
        <>
          <ImageViewer
            defaultOpen
            images={loaded}
            onLoadMore={() =>
              new Promise<void>((resolve) => {
                setLoading(() => () => {
                  setLoaded((current) => [
                    ...current,
                    ...page(current.length + 1),
                  ]);
                  resolve();
                });
              })
            }
            total={4}
          />
          {loading && (
            <button
              onClick={() => {
                loading();
                setLoading(null);
              }}
              type="button"
            >
              Arrive
            </button>
          )}
        </>
      );
    }
    render(<Gallery />);

    expect(screen.getByText("1 of 4")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next image" }));
    // The last loaded image shows - the next ones load meanwhile
    expect(screen.getByAltText("Photo 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next image" }));
    expect(screen.getByText("3 of 4")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading");

    // `Arrive` is outside the modal dialog, which keeps the pointer in
    fireEvent.click(
      screen.getByRole("button", { name: "Arrive", hidden: true }),
    );
    expect(await screen.findByAltText("Photo 3")).toBeInTheDocument();
    // At the end of all of them, it goes round again
    await user.click(screen.getByRole("button", { name: "Next image" }));
    await user.click(screen.getByRole("button", { name: "Next image" }));
    expect(screen.getByText("1 of 4")).toBeInTheDocument();
  });

  it("says when the next images fail to load", async () => {
    const user = userEvent.setup();
    render(
      <ImageViewer
        defaultIndex={1}
        defaultOpen
        images={images}
        onLoadMore={() => Promise.reject(new Error("Offline"))}
        total={5}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Next image" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    // Back to a loaded image
    await user.click(screen.getByRole("button", { name: "Previous image" }));
    expect(screen.getByText("A river")).toBeInTheDocument();
  });

  it("moves on with a swipe on a touch screen, not with the mouse", () => {
    const onIndexChange = vi.fn();
    render(
      <ImageViewer defaultOpen images={images} onIndexChange={onIndexChange} />,
    );

    const area = screen.getByAltText("First landscape").parentElement!;
    const swipe = (pointerType: string, from: number, to: number) => {
      fireEvent.pointerDown(area, {
        clientX: from,
        clientY: 100,
        isPrimary: true,
        pointerId: 1,
        pointerType,
      });
      fireEvent.pointerUp(area, {
        clientX: to,
        clientY: 110,
        pointerId: 1,
        pointerType,
      });
    };

    swipe("mouse", 300, 100);
    expect(onIndexChange).not.toHaveBeenCalled();
    // A short move is no swipe
    swipe("touch", 300, 280);
    expect(onIndexChange).not.toHaveBeenCalled();
    swipe("touch", 300, 100);
    expect(onIndexChange).toHaveBeenLastCalledWith(1);
  });
});
