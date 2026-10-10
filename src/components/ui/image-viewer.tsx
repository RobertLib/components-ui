import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import cn from "../../utils/cn";
import isPromiseLike from "../../utils/is-promise-like";
import { formatMessage } from "../../i18n/ui/format";
import { useMessages } from "../../providers/ui-context";
import Dialog from "./dialog";
import IconButton from "./icon-button";
import EmptyState from "./empty-state";

export interface ImageViewerImage {
  /** Full image URL. */
  src: string;
  /** Text alternative describing the image. */
  alt: string;
  /** Text shown under the image. */
  caption?: React.ReactNode;
  /** Optional smaller image for the thumbnail strip. */
  thumbnailSrc?: string;
}

export interface ImageViewerProps extends Omit<
  React.ComponentProps<"div">,
  "children" | "title" | "onChange"
> {
  /** Images in navigation order. */
  images: readonly ImageViewerImage[];
  /** Controlled visibility. Defaults to closed. */
  open?: boolean;
  /** Initial visibility of an uncontrolled viewer. */
  defaultOpen?: boolean;
  /** Visibility requested by the close button, Escape or backdrop. */
  onOpenChange?: (open: boolean) => void;
  /** Called when the user closes the viewer. */
  onClose?: () => void;
  /** Controlled image index. */
  index?: number;
  /** Initial image index. Defaults to zero. */
  defaultIndex?: number;
  /** Image requested by the arrows or thumbnails. */
  onIndexChange?: (index: number) => void;
  /** Accessible dialog heading. */
  title?: React.ReactNode;
  /** Wrap navigation at the first and last image. Defaults to true. */
  loop?: boolean;
  /**
   * Loads further images of a gallery that `images` holds a page of - e.g.
   * `fetchNextPage` of an infinite query. Called as the last loaded image
   * shows, while `total` says there are more; moving past it waits for
   * them with a loading state. A throw, a rejected promise - or one
   * resolved without new images, as with a `total` too high - shows the
   * error of the image there; moving away and back asks again, and so does
   * another gallery of as many images. Wrapping around (`loop`) starts
   * once all are loaded. It may be taken away while the images it
   * asked for load (`isFetchingNextPage ? undefined : fetchNextPage`) - not
   * while any fetch runs (`isFetching`, also of a refetch): taken away
   * otherwise, the arrows stay on the loaded images.
   */
  onLoadMore?: () => unknown;
  /** Show thumbnail navigation when there are several images. Defaults to true. */
  thumbnails?: boolean;
  /**
   * How many images the whole gallery has, when `images` holds only those
   * loaded so far - the position reads "3 / 48", and with `onLoadMore` the
   * arrows go on past the loaded ones.
   */
  total?: number;
}

const clampIndex = (index: number, length: number) =>
  Math.max(
    0,
    Math.min(length - 1, Number.isFinite(index) ? Math.floor(index) : 0),
  );

// A swipe this long sideways - more sideways than down - moves on
const SWIPE_DISTANCE = 50;

/** Whether the page is pinch-zoomed in - a drag then pans it. */
const isPageZoomed = () => (window.visualViewport?.scale ?? 1) > 1;

// The visual viewport resizes as the page zooms
const subscribeToPageZoom = (onChange: () => void) => {
  const viewport = window.visualViewport;
  viewport?.addEventListener("resize", onChange);
  return () => viewport?.removeEventListener("resize", onChange);
};

/** A modal image gallery with keyboard navigation, zoom and loading/error states. */
export default function ImageViewer({
  className,
  defaultIndex = 0,
  defaultOpen = false,
  images,
  index: controlledIndex,
  loop = true,
  onClose,
  onIndexChange,
  onKeyDown,
  onLoadMore,
  onOpenChange,
  open: controlledOpen,
  thumbnails = true,
  title,
  total,
  ...props
}: ImageViewerProps) {
  const messages = useMessages().ui.imageViewer;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [internalIndex, setInternalIndex] = useState(defaultIndex);
  const open = controlledOpen ?? internalOpen;
  // The loaded images, by their number and the last of them - another
  // gallery of as many (an album the parent swaps while the viewer is open)
  // is not the one `onLoadMore` was called or failed for
  const loadedKey = `${images.length}:${images[images.length - 1]?.src ?? ""}`;
  // `onLoadMore` was called for these loaded images - more can come also
  // while the parent takes it away as it loads, so the image shown and the
  // arrows stay where they are
  const [requestedFor, setRequestedFor] = useState<string | null>(null);
  // The whole gallery - the loaded images and those still to load
  const count = Math.max(total ?? 0, images.length);
  const canLoadMore =
    images.length < count && (!!onLoadMore || requestedFor === loadedKey);
  // The images the arrows reach - past the loaded ones only while more can
  // load (they show loading); a `total` alone changes just the position
  const reachable = canLoadMore ? count : images.length;
  const index = clampIndex(controlledIndex ?? internalIndex, reachable);

  useLayoutEffect(() => {
    latest.current = { index, loadedKey, onLoadMore };
  });
  const image = images[index];
  const isWaiting = index >= images.length && canLoadMore;
  // `onLoadMore` failed for these loaded images - it rejected, or resolved
  // without more: the next one cannot show
  const [failedLoad, setFailedLoad] = useState<string | null>(null);
  // The request and its failure are done with once these images are no
  // longer loaded - more came, or the parent replaced them. Back to as many,
  // more can load again.
  if (requestedFor !== null && requestedFor !== loadedKey) {
    setRequestedFor(null);
  }
  if (failedLoad !== null && failedLoad !== loadedKey) setFailedLoad(null);
  const hasFailedLoad = isWaiting && failedLoad === loadedKey;
  // The error shows a render later, after the transitions still pending -
  // images the parent stores in one come first, and it does not show with
  // them. It hides at once.
  const showsFailedLoad = useDeferredValue(hasFailedLoad) && hasFailedLoad;
  // The call of `onLoadMore` for the loaded images - once while they stay
  // loaded; after a failure, again once the image shown changed
  const request = useRef<{ key: string; failedAt?: number } | null>(null);
  // What the last render got - a new `onLoadMore` of each render of the
  // parent (an inline function) is no reason to call it again
  const latest = useRef({ index: 0, loadedKey, onLoadMore });
  const swipeStart = useRef<{ id: number; x: number; y: number } | null>(null);

  // The next images load as the last loaded one shows, so that moving on
  // does not wait for them
  useEffect(() => {
    if (!open) {
      // Another gallery may open next - with as many images
      request.current = null;
      return;
    }
    // Done with once these images are no longer loaded - back to as many
    // (the parent trimmed them to the first page), it asks again
    if (request.current && request.current.key !== loadedKey) {
      request.current = null;
    }
    // Moving away and back after a failure asks again - not a render of the
    // parent, also one taking `onLoadMore` away while it loads and giving it
    // back after the failure (`isFetchingNextPage ? undefined : fetchNextPage`)
    const failedAt = request.current?.failedAt;
    if (failedAt !== undefined && failedAt !== index) request.current = null;
    if (
      !canLoadMore ||
      index < images.length - 1 ||
      request.current?.key === loadedKey
    ) {
      return;
    }
    // None to ask while the parent takes it away - the failure stays, and
    // moving again asks
    if (!latest.current.onLoadMore) return;
    const current: { key: string; failedAt?: number } = { key: loadedKey };
    request.current = current;
    setRequestedFor(current.key);
    // Loading again, after moving away and back
    setFailedLoad((failed) => (failed === current.key ? null : failed));

    // Unless the viewer closed or asked for the next ones meanwhile
    const fail = () => {
      if (request.current !== current) return;
      current.failedAt = latest.current.index;
      setFailedLoad(current.key);
    };
    let result: unknown;
    try {
      result = latest.current.onLoadMore();
    } catch {
      // A failed load like a rejected promise - not a crash of the viewer
      fail();
      return;
    }
    // Without a promise the images may come at any time - they are awaited
    if (!isPromiseLike(result)) return;
    Promise.resolve(result).then(
      // The images come with a render of the parent - also one a turn
      // later (TanStack Query tells its observers in a timeout). None by
      // then is a failure: a `total` too high would wait for ever.
      () =>
        setTimeout(() => {
          if (latest.current.loadedKey === current.key) fail();
        }),
      fail,
    );
  }, [canLoadMore, images.length, index, loadedKey, open]);
  const [zoom, setZoom] = useState(1);
  const pageZoomed = useSyncExternalStore(
    subscribeToPageZoom,
    isPageZoomed,
    () => false,
  );
  const [loaded, setLoaded] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const imageKey = image?.src;
  const [previousImage, setPreviousImage] = useState(imageKey);
  const [previousOpen, setPreviousOpen] = useState(open);
  if (previousImage !== imageKey || previousOpen !== open) {
    setPreviousImage(imageKey);
    setPreviousOpen(open);
    setZoom(1);
    setFailed(null);
    setLoaded(null);
    // Another gallery may open next - the request and the failure were of
    // this one
    if (previousOpen !== open) {
      setRequestedFor(null);
      setFailedLoad(null);
    }
  }
  const close = () => {
    if (controlledOpen === undefined) setInternalOpen(false);
    onOpenChange?.(false);
    onClose?.();
  };
  // Around from the end to the start only once all images are loaded
  const wraps = loop && !canLoadMore;
  const select = (next: number) => {
    if (reachable === 0) return;
    const target = wraps
      ? (next + reachable) % reachable
      : clampIndex(next, reachable);
    if (target === index) return;
    if (controlledIndex === undefined) setInternalIndex(target);
    onIndexChange?.(target);
  };
  const previousDisabled = reachable < 2 || (!wraps && index === 0);
  const nextDisabled = reachable < 2 || (!wraps && index === reachable - 1);
  const isRtl = (element: Element) =>
    getComputedStyle(element).direction === "rtl";

  // A swipe sideways on a touch screen moves to the next or the previous
  // image - not while the image or the page is zoomed in, when it pans
  // them, nor a gesture of two fingers (a pinch zoom of the page)
  const swipeHandlers = {
    onPointerCancel: () => {
      swipeStart.current = null;
    },
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      if (!event.isPrimary) {
        swipeStart.current = null;
        return;
      }
      if (event.pointerType === "mouse" || zoom !== 1) return;
      swipeStart.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
    },
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
      const start = swipeStart.current;
      swipeStart.current = null;
      // Also a page zoomed in meanwhile - the browser may not have
      // cancelled the swipe
      if (!start || start.id !== event.pointerId || isPageZoomed()) return;

      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) <= Math.abs(dy)) {
        return;
      }
      // The next image comes from the end of the line - a swipe towards
      // the start (to the left, to the right right to left) brings it
      const towardsStart = isRtl(event.currentTarget) ? dx > 0 : dx < 0;
      select(index + (towardsStart ? 1 : -1));
    },
  };
  return (
    <Dialog
      closeOnBackdropClick
      fullScreenOnMobile
      onClose={close}
      open={open}
      size="full"
      title={title ?? messages.title}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (
          event.defaultPrevented ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.nativeEvent.isComposing
        )
          return;
        const rtl = isRtl(event.currentTarget);
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          select(index + ((event.key === "ArrowRight") !== rtl ? 1 : -1));
        } else if (event.key === "Home") {
          event.preventDefault();
          select(0);
        } else if (event.key === "End") {
          event.preventDefault();
          select(reachable - 1);
        }
      }}
    >
      <div {...props} className={cn("flex min-h-0 flex-col gap-3", className)}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <IconButton
              aria-label={messages.previous}
              disabled={previousDisabled}
              onClick={() => select(index - 1)}
            >
              <ChevronLeft className="rtl:rotate-180" size={18} />
            </IconButton>
            <span aria-live="polite" className="text-sm tabular-nums">
              {formatMessage(messages.position, {
                // None shown - also of a `total` none of which can load
                index: reachable ? index + 1 : 0,
                total: count,
              })}
            </span>
            <IconButton
              aria-label={messages.next}
              disabled={nextDisabled}
              onClick={() => select(index + 1)}
            >
              <ChevronRight className="rtl:rotate-180" size={18} />
            </IconButton>
          </div>
          <div
            aria-label={messages.zoom}
            className="flex items-center gap-2"
            role="group"
          >
            <IconButton
              aria-label={messages.zoomOut}
              disabled={!image || zoom <= 1}
              onClick={() => setZoom((value) => Math.max(1, value - 0.5))}
            >
              <ZoomOut size={18} />
            </IconButton>
            <span className="text-sm tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <IconButton
              aria-label={messages.zoomIn}
              disabled={!image || zoom >= 3}
              onClick={() => setZoom((value) => Math.min(3, value + 0.5))}
            >
              <ZoomIn size={18} />
            </IconButton>
            <IconButton
              aria-label={messages.resetZoom}
              disabled={zoom === 1}
              onClick={() => setZoom(1)}
            >
              <RotateCcw size={18} />
            </IconButton>
          </div>
        </div>
        {isWaiting ? (
          // An image of the gallery not loaded yet - `onLoadMore` brings it
          <div
            {...swipeHandlers}
            aria-busy={!showsFailedLoad}
            className={cn(
              "flex h-[55dvh] min-h-32 items-center justify-center rounded bg-neutral-100 p-8 text-center text-sm dark:bg-neutral-900",
              !pageZoomed && "touch-pan-y touch-pinch-zoom",
            )}
          >
            {showsFailedLoad ? (
              <div role="alert">{messages.loadError}</div>
            ) : (
              <div role="status">{messages.loading}</div>
            )}
          </div>
        ) : !image ? (
          <EmptyState title={messages.noImages} />
        ) : (
          <figure className="min-h-0">
            <div
              {...swipeHandlers}
              aria-busy={loaded !== image.src && failed !== image.src}
              className={cn(
                "relative max-h-[60dvh] min-h-32 overflow-auto rounded bg-neutral-100 dark:bg-neutral-900",
                // Sideways moves are swipes, not panning, unless the image
                // or the page is zoomed in - a pinch still zooms the page
                zoom === 1 && !pageZoomed && "touch-pan-y touch-pinch-zoom",
              )}
              tabIndex={0}
            >
              {failed === image.src ? (
                <div role="alert" className="p-8 text-center">
                  {messages.loadError}
                </div>
              ) : (
                <>
                  {loaded !== image.src && (
                    <div
                      className="absolute inset-0 flex items-center justify-center text-sm"
                      role="status"
                    >
                      {messages.loading}
                    </div>
                  )}
                  <img
                    alt={image.alt}
                    className={cn(
                      "mx-auto block object-contain",
                      zoom === 1 && "max-w-full",
                    )}
                    onError={() => setFailed(image.src)}
                    onLoad={() => setLoaded(image.src)}
                    src={image.src}
                    style={{
                      height: `${zoom * 55}dvh`,
                      maxWidth: zoom === 1 ? "100%" : "none",
                      opacity: loaded === image.src ? 1 : 0,
                    }}
                  />
                </>
              )}
            </div>
            {image.caption && (
              <figcaption className="mt-2 text-center text-sm text-neutral-600 dark:text-neutral-400">
                {image.caption}
              </figcaption>
            )}
          </figure>
        )}
        {thumbnails && images.length > 1 && (
          <div
            aria-label={messages.images}
            className="flex gap-2 overflow-x-auto p-1"
            role="group"
          >
            {images.map((entry, imageIndex) => (
              <button
                aria-label={
                  entry.alt ||
                  formatMessage(messages.image, { index: imageIndex + 1 })
                }
                aria-pressed={imageIndex === index}
                className={cn(
                  "h-14 w-20 shrink-0 cursor-pointer overflow-hidden rounded border-2 focus-visible:outline-2 focus-visible:outline-primary-500",
                  imageIndex === index
                    ? "border-primary-500"
                    : "border-transparent",
                )}
                key={`${imageIndex}:${entry.src}`}
                onClick={() => select(imageIndex)}
                type="button"
              >
                <img
                  alt=""
                  className="size-full object-cover"
                  loading="lazy"
                  src={entry.thumbnailSrc ?? entry.src}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
