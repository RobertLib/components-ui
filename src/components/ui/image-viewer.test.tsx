import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { startTransition, useEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import ImageViewer from "./image-viewer";

const images = [
  { src: "/one.png", alt: "First landscape", caption: "A mountain" },
  { src: "/two.png", alt: "Second landscape", caption: "A river" },
];

// A page of two images of a gallery loaded by pages
const page = (from: number) =>
  [from, from + 1].map((number) => ({
    alt: `Photo ${number}`,
    src: `/photo-${number}.png`,
  }));

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

  it("leaves the arrow keys, Home and End to the area of the image zoomed in", async () => {
    const user = userEvent.setup();
    const onIndexChange = vi.fn();
    render(
      <ImageViewer defaultOpen images={images} onIndexChange={onIndexChange} />,
    );
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    // The area that scrolls the image - focused, it pans it
    const area = screen.getByRole("img", { name: "First landscape" })
      .parentElement as HTMLElement;
    act(() => area.focus());

    for (const key of ["ArrowRight", "ArrowLeft", "Home", "End"]) {
      // Not prevented - the browser scrolls the area
      expect(fireEvent.keyDown(area, { key })).toBe(true);
    }
    expect(onIndexChange).not.toHaveBeenCalled();
    expect(screen.getByText("150%")).toBeInTheDocument();

    // Not zoomed in, it moves on
    await user.click(screen.getByRole("button", { name: "Reset zoom" }));
    act(() => area.focus());
    await user.keyboard("{ArrowRight}");
    expect(onIndexChange).toHaveBeenCalledWith(1);
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

  it("says so when onLoadMore throws instead of rejecting", async () => {
    const user = userEvent.setup();
    render(
      <ImageViewer
        defaultIndex={1}
        defaultOpen
        images={images}
        onLoadMore={() => {
          throw new Error("No session");
        }}
        total={5}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Next image" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Previous image" }));
    expect(screen.getByText("A river")).toBeInTheDocument();
  });

  it("asks again only when moved away and back, not at a render of the parent", async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    function Gallery() {
      const [failures, setFailures] = useState(0);
      return (
        <ImageViewer
          defaultIndex={1}
          defaultOpen
          images={images}
          // A new function as the parent renders - it notes the failure,
          // like a query flipping `isFetchingNextPage`
          onLoadMore={() => {
            onLoadMore(failures);
            const result = Promise.reject(new Error("Offline"));
            result.catch(() =>
              setTimeout(() => setFailures((count) => count + 1)),
            );
            return result;
          }}
          total={5}
        />
      );
    }
    render(<Gallery />);

    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(onLoadMore).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Previous image" }));
    await user.click(screen.getByRole("button", { name: "Next image" }));
    expect(onLoadMore).toHaveBeenCalledTimes(2);
  });

  it("asks no more after a failure while the parent takes onLoadMore away as it loads", async () => {
    const onLoadMore = vi.fn();
    function Gallery() {
      const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
      const fetchNextPage = () => {
        onLoadMore();
        setIsFetchingNextPage(true);
        return new Promise<void>((_, reject) =>
          setTimeout(() => {
            setIsFetchingNextPage(false);
            reject(new Error("Offline"));
          }),
        );
      };
      return (
        <ImageViewer
          defaultIndex={1}
          defaultOpen
          images={images}
          onLoadMore={isFetchingNextPage ? undefined : fetchNextPage}
          total={5}
        />
      );
    }
    render(<Gallery />);

    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(onLoadMore).toHaveBeenCalledOnce();
  });

  it("asks once past the loaded images while the parent takes onLoadMore away as it loads", async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    let fail = () => {};
    function Gallery() {
      const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
      const fetchNextPage = () => {
        onLoadMore();
        setIsFetchingNextPage(true);
        return new Promise<void>((_, reject) => {
          fail = () => {
            setIsFetchingNextPage(false);
            reject(new Error("Offline"));
          };
        });
      };
      return (
        <ImageViewer
          defaultIndex={2}
          defaultOpen
          images={images}
          onLoadMore={isFetchingNextPage ? undefined : fetchNextPage}
          total={5}
        />
      );
    }
    render(<Gallery />);
    expect(screen.getByText("3 of 5")).toBeInTheDocument();

    await act(async () => fail());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The image could not be loaded.",
    );
    // Not again as the parent gives onLoadMore back
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(onLoadMore).toHaveBeenCalledOnce();
    expect(screen.getByText("3 of 5")).toBeInTheDocument();

    // Moving away and back asks again
    await user.click(screen.getByRole("button", { name: "Previous image" }));
    expect(onLoadMore).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole("button", { name: "Next image" }));
    expect(screen.getByText("Loading image…")).toBeInTheDocument();
    expect(onLoadMore).toHaveBeenCalledTimes(2);
  });

  it("goes on to the next image, not round, while the parent takes onLoadMore away as it loads", async () => {
    const user = userEvent.setup();
    const onIndexChange = vi.fn();
    function Gallery() {
      const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
      return (
        <ImageViewer
          defaultIndex={1}
          defaultOpen
          images={images}
          onIndexChange={onIndexChange}
          onLoadMore={
            isFetchingNextPage
              ? undefined
              : () => {
                  setIsFetchingNextPage(true);
                  return new Promise(() => {});
                }
          }
          total={5}
        />
      );
    }
    render(<Gallery />);

    await user.click(screen.getByRole("button", { name: "Next image" }));
    expect(onIndexChange).toHaveBeenLastCalledWith(2);
    expect(screen.getByText("3 of 5")).toBeInTheDocument();
    expect(screen.getByText("Loading image…")).toBeInTheDocument();
    await user.keyboard("{End}");
    expect(screen.getByText("5 of 5")).toBeInTheDocument();
  });

  it("says when the next images resolved without coming", async () => {
    const user = userEvent.setup();
    // A `total` too high - the last page brings nothing; then it is slow
    const onLoadMore = vi
      .fn<() => Promise<void>>()
      .mockResolvedValueOnce(undefined)
      .mockReturnValue(new Promise(() => {}));
    render(
      <ImageViewer
        defaultIndex={2}
        defaultOpen
        images={images}
        onLoadMore={onLoadMore}
        total={3}
      />,
    );

    expect(screen.getByText("Loading image…")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The image could not be loaded.",
    );
    expect(onLoadMore).toHaveBeenCalledOnce();

    // Moving away and back asks again - loading meanwhile
    await user.click(screen.getByRole("button", { name: "Previous image" }));
    expect(onLoadMore).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole("button", { name: "Next image" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Loading image…")).toBeInTheDocument();
  });

  it("shows no error while the parent stores the next images in a transition", async () => {
    let arrive = () => {};

    function Gallery() {
      const [loaded, setLoaded] = useState(page(1));
      return (
        <ImageViewer
          defaultIndex={2}
          defaultOpen
          images={loaded}
          onLoadMore={() =>
            new Promise<void>((resolve) => {
              arrive = () => {
                startTransition(() =>
                  setLoaded((current) => [...current, ...page(3)]),
                );
                resolve();
              };
            })
          }
          total={4}
        />
      );
    }
    render(<Gallery />);
    expect(screen.getByText("Loading image…")).toBeInTheDocument();

    // Every alert on the way - also one gone again in the same task. The
    // loading state turns into it in place, with a new role.
    const alerts: Node[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        const nodes =
          record.type === "attributes"
            ? [record.target]
            : [...record.addedNodes];
        alerts.push(
          ...nodes.filter(
            (node) => node instanceof Element && node.closest("[role=alert]"),
          ),
        );
      }
    });
    observer.observe(document.body, {
      attributeFilter: ["role"],
      childList: true,
      subtree: true,
    });

    // The transition renders as the act ends - long after the turn the
    // viewer waits for the images, which then fails the load
    await act(async () => {
      arrive();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    observer.disconnect();

    expect(screen.getByAltText("Photo 3")).toBeInTheDocument();
    expect(alerts).toEqual([]);
  });

  it("asks a gallery opened after another with as many images for more", () => {
    const first = vi.fn(() => new Promise(() => {}));
    const second = vi.fn(() => new Promise(() => {}));
    const { rerender } = render(
      <ImageViewer
        defaultIndex={1}
        images={images}
        onLoadMore={first}
        open
        total={5}
      />,
    );
    expect(first).toHaveBeenCalledOnce();

    rerender(
      <ImageViewer
        defaultIndex={1}
        images={images}
        onLoadMore={first}
        open={false}
        total={5}
      />,
    );
    const others = images.map((image) => ({
      ...image,
      src: `/other${image.src}`,
    }));
    rerender(
      <ImageViewer
        defaultIndex={1}
        images={others}
        onLoadMore={second}
        open
        total={4}
      />,
    );
    expect(second).toHaveBeenCalledOnce();
    expect(first).toHaveBeenCalledOnce();
  });

  it("asks a gallery swapped for another of as many images while open", async () => {
    const user = userEvent.setup();
    let arrive = () => {};
    const first = vi.fn(() => Promise.reject(new Error("Offline")));
    const second = vi.fn(
      () => new Promise<void>((resolve) => (arrive = resolve)),
    );
    const third = vi.fn(() => new Promise(() => {}));
    const gallery = (prefix: string, onLoadMore: () => Promise<unknown>) => (
      <ImageViewer
        defaultIndex={1}
        images={images.map((image) => ({
          ...image,
          src: `${prefix}${image.src}`,
        }))}
        onLoadMore={onLoadMore}
        open
        total={5}
      />
    );
    const { rerender } = render(gallery("", first));
    await user.click(screen.getByRole("button", { name: "Next image" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    // Not the failure of the gallery before
    rerender(gallery("/second", second));
    expect(second).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // Nor one of a request still loading at the swap
    rerender(gallery("/third", third));
    expect(third).toHaveBeenCalledOnce();
    await act(async () => {
      arrive();
      await new Promise((resolve) => setTimeout(resolve));
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(third).toHaveBeenCalledOnce();
  });

  it("asks again when the parent goes back to as many images as it once asked for", async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    let arrive = () => {};
    let trim = () => {};
    function Gallery() {
      const [loaded, setLoaded] = useState(page(1));
      // Back to the first page - an infinite query trimmed to it
      useEffect(() => {
        trim = () => setLoaded(page(1));
      }, []);
      return (
        <ImageViewer
          defaultIndex={1}
          defaultOpen
          images={loaded}
          onLoadMore={() => {
            onLoadMore();
            return new Promise<void>((resolve) => {
              arrive = () => {
                setLoaded((current) => [
                  ...current,
                  ...page(current.length + 1),
                ]);
                resolve();
              };
            });
          }}
          total={6}
        />
      );
    }
    render(<Gallery />);
    expect(onLoadMore).toHaveBeenCalledOnce();
    await act(async () => arrive());
    await user.click(screen.getByRole("button", { name: "Next image" }));
    expect(screen.getByAltText("Photo 3")).toBeInTheDocument();

    await act(async () => trim());
    expect(screen.getByText("3 of 6")).toBeInTheDocument();
    expect(screen.getByText("Loading image…")).toBeInTheDocument();
    expect(onLoadMore).toHaveBeenCalledTimes(2);
    await act(async () => arrive());
    expect(screen.getByAltText("Photo 3")).toBeInTheDocument();
  });

  it("forgets the images it asked for once they came, also while the parent takes onLoadMore away", async () => {
    const onLoadMore = vi.fn();
    let arrive = () => {};
    let refetch = () => {};
    let refetched = () => {};
    function Gallery() {
      const [loaded, setLoaded] = useState(page(1));
      const [isRefetching, setIsRefetching] = useState(false);
      // Back to the first page, taking onLoadMore away until it is there
      useEffect(() => {
        refetch = () => {
          setLoaded(page(1));
          setIsRefetching(true);
        };
        refetched = () => setIsRefetching(false);
      }, []);
      return (
        <ImageViewer
          defaultIndex={2}
          defaultOpen
          images={loaded}
          onLoadMore={
            isRefetching
              ? undefined
              : () => {
                  onLoadMore();
                  return new Promise<void>((resolve) => {
                    arrive = () => {
                      setLoaded((current) => [
                        ...current,
                        ...page(current.length + 1),
                      ]);
                      resolve();
                    };
                  });
                }
          }
          total={6}
        />
      );
    }
    render(<Gallery />);
    await act(async () => arrive());
    expect(screen.getByAltText("Photo 3")).toBeInTheDocument();

    // Not the image past the loaded ones - nothing would load it
    await act(async () => refetch());
    expect(screen.getByText("2 of 6")).toBeInTheDocument();
    expect(screen.getByAltText("Photo 2")).toBeInTheDocument();
    expect(onLoadMore).toHaveBeenCalledOnce();

    await act(async () => refetched());
    expect(screen.getByText("3 of 6")).toBeInTheDocument();
    expect(onLoadMore).toHaveBeenCalledTimes(2);
    await act(async () => arrive());
    expect(screen.getByAltText("Photo 3")).toBeInTheDocument();
  });

  it("navigates the loaded images alone with a total but no onLoadMore", async () => {
    const user = userEvent.setup();
    const onIndexChange = vi.fn();
    const { rerender } = render(
      <ImageViewer
        defaultIndex={1}
        defaultOpen
        images={images}
        onIndexChange={onIndexChange}
        total={10}
      />,
    );

    // The position counts the whole gallery
    expect(screen.getByText("2 of 10")).toBeInTheDocument();
    // Round to the first image - not to the third, which is not there
    await user.click(screen.getByRole("button", { name: "Next image" }));
    expect(onIndexChange).toHaveBeenLastCalledWith(0);
    await user.keyboard("{End}");
    expect(onIndexChange).toHaveBeenLastCalledWith(1);

    rerender(
      <ImageViewer
        defaultOpen
        images={images}
        loop={false}
        onIndexChange={onIndexChange}
        total={10}
      />,
    );
    expect(screen.getByText("2 of 10")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next image" })).toBeDisabled();

    // None loaded - none shown
    rerender(<ImageViewer defaultOpen images={[]} total={10} />);
    expect(screen.getByText("0 of 10")).toBeInTheDocument();
    expect(screen.getByText("No images")).toBeInTheDocument();
  });

  it("leaves a pinch to the browser - two fingers are no swipe", () => {
    const onIndexChange = vi.fn();
    render(
      <ImageViewer defaultOpen images={images} onIndexChange={onIndexChange} />,
    );

    const area = screen.getByAltText("First landscape").parentElement!;
    expect(area).toHaveClass("touch-pan-y", "touch-pinch-zoom");

    // The fingers of a pinch move apart - the first one far sideways. It
    // is lifted first: the second finger touching down ended its swipe.
    fireEvent.pointerDown(area, {
      clientX: 300,
      clientY: 100,
      isPrimary: true,
      pointerId: 1,
      pointerType: "touch",
    });
    fireEvent.pointerDown(area, {
      clientX: 320,
      clientY: 100,
      isPrimary: false,
      pointerId: 2,
      pointerType: "touch",
    });
    fireEvent.pointerUp(area, {
      clientX: 100,
      clientY: 100,
      pointerId: 1,
      pointerType: "touch",
    });
    fireEvent.pointerUp(area, {
      clientX: 400,
      clientY: 100,
      pointerId: 2,
      pointerType: "touch",
    });
    expect(onIndexChange).not.toHaveBeenCalled();
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

  it("leaves a drag on a page pinch-zoomed in to the browser to pan", () => {
    // Fires its own resize, as the visual viewport of a phone does
    const viewport = Object.assign(new EventTarget(), { scale: 2 });
    vi.stubGlobal("visualViewport", viewport);
    try {
      const onIndexChange = vi.fn();
      render(
        <ImageViewer
          defaultOpen
          images={images}
          onIndexChange={onIndexChange}
        />,
      );

      const area = screen.getByAltText("First landscape").parentElement!;
      const swipe = () => {
        fireEvent.pointerDown(area, {
          clientX: 300,
          clientY: 100,
          isPrimary: true,
          pointerId: 1,
          pointerType: "touch",
        });
        fireEvent.pointerUp(area, {
          clientX: 100,
          clientY: 110,
          pointerId: 1,
          pointerType: "touch",
        });
      };

      expect(area).not.toHaveClass("touch-pan-y");
      swipe();
      expect(onIndexChange).not.toHaveBeenCalled();

      // Zoomed out again - a swipe moves on
      viewport.scale = 1;
      act(() => {
        viewport.dispatchEvent(new Event("resize"));
      });
      expect(area).toHaveClass("touch-pan-y", "touch-pinch-zoom");
      swipe();
      expect(onIndexChange).toHaveBeenLastCalledWith(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
