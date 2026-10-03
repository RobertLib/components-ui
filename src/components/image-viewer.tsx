import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useState } from "react";
import cn from "../utils/cn";
import { formatMessage } from "../i18n/format";
import { useMessages } from "../providers/ui-context";
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
  /** Show thumbnail navigation when there are several images. Defaults to true. */
  thumbnails?: boolean;
}

const clampIndex = (index: number, length: number) =>
  Math.max(
    0,
    Math.min(length - 1, Number.isFinite(index) ? Math.floor(index) : 0),
  );

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
  onOpenChange,
  open: controlledOpen,
  thumbnails = true,
  title,
  ...props
}: ImageViewerProps) {
  const messages = useMessages().imageViewer;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [internalIndex, setInternalIndex] = useState(defaultIndex);
  const open = controlledOpen ?? internalOpen;
  const index = clampIndex(controlledIndex ?? internalIndex, images.length);
  const image = images[index];
  const [zoom, setZoom] = useState(1);
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
  }
  const close = () => {
    if (controlledOpen === undefined) setInternalOpen(false);
    onOpenChange?.(false);
    onClose?.();
  };
  const select = (next: number) => {
    if (images.length === 0) return;
    const target = loop
      ? (next + images.length) % images.length
      : clampIndex(next, images.length);
    if (target === index) return;
    if (controlledIndex === undefined) setInternalIndex(target);
    onIndexChange?.(target);
  };
  const previousDisabled = images.length < 2 || (!loop && index === 0);
  const nextDisabled =
    images.length < 2 || (!loop && index === images.length - 1);
  return (
    <Dialog
      closeOnBackdropClick
      fullScreenOnMobile
      onClose={close}
      open={open}
      size="full"
      title={title ?? messages.title}
    >
      <div
        {...props}
        className={cn("flex min-h-0 flex-col gap-3", className)}
        onKeyDown={(event) => {
          props.onKeyDown?.(event);
          if (
            event.defaultPrevented ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            event.nativeEvent.isComposing
          )
            return;
          const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            select(index + ((event.key === "ArrowRight") !== rtl ? 1 : -1));
          } else if (event.key === "Home") {
            event.preventDefault();
            select(0);
          } else if (event.key === "End") {
            event.preventDefault();
            select(images.length - 1);
          }
        }}
      >
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
                index: images.length ? index + 1 : 0,
                total: images.length,
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
        {!image ? (
          <EmptyState title={messages.noImages} />
        ) : (
          <figure className="min-h-0">
            <div
              aria-busy={loaded !== image.src && failed !== image.src}
              className="relative max-h-[60dvh] min-h-32 overflow-auto rounded bg-neutral-100 dark:bg-neutral-900"
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
