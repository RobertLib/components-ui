import { UserCircle } from "lucide-react";
import { useState } from "react";
import cn from "../utils/cn";
import { formatMessage } from "../i18n/format";
import { useMessages } from "../providers/ui-context";

export type AvatarSize = "sm" | "md" | "lg" | "xl";

export interface AvatarProps extends React.ComponentProps<"div"> {
  /**
   * Alternative text of the image - and the name of the initials; defaults
   * to `name`. An empty one marks the avatar as decorative, e.g. next to the
   * name written out.
   */
  alt?: string;
  /** Shown as initials when there is no image (or it fails to load). */
  name?: string;
  /** Diameter: 24, 32, 48 or 64 px. */
  size?: AvatarSize;
  /** URL of a profile picture. */
  src?: string;
  /**
   * A dot in the corner telling whether the person is available. Screen
   * readers hear it with the name ("Jana Nováková, Online"), a pointer shows
   * it as the title of the dot. Besides the color, each has a shape of its
   * own: online is a dot, busy has a bar, away is a crescent and offline is
   * hollow.
   */
  status?: "online" | "offline" | "busy" | "away";
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-xl",
};

const iconSizes: Record<AvatarSize, number> = {
  sm: 24,
  md: 32,
  lg: 48,
  xl: 64,
};

const statusSizeClasses: Record<AvatarSize, string> = {
  sm: "size-2",
  md: "size-2.5",
  lg: "size-3",
  xl: "size-4",
};

// A shape of each besides the color, which stands out from the surface
// around the dot by at least 3:1 (WCAG 1.4.11)
const statusClasses: Record<NonNullable<AvatarProps["status"]>, string> = {
  // A crescent - the surface cuts a circle out of it
  away: "overflow-hidden bg-warning-700 after:absolute after:-top-[15%] after:-left-[15%] after:size-[70%] after:rounded-full after:bg-surface dark:bg-warning-500 dark:after:bg-surface-dark",
  busy: "bg-danger-500 after:absolute after:top-1/2 after:left-1/2 after:h-[20%] after:min-h-0.5 after:w-1/2 after:-translate-1/2 after:rounded-full after:bg-white",
  offline:
    "border-2 border-neutral-500 bg-surface dark:border-neutral-500 dark:bg-surface-dark",
  online: "bg-success-600 dark:bg-success-500",
};

const graphemeSegmenter =
  typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

/** The characters of a text as the reader sees them - "👩‍💻" is one. */
const graphemesOf = (text: string) =>
  graphemeSegmenter
    ? Array.from(graphemeSegmenter.segment(text), ({ segment }) => segment)
    : Array.from(text);

/**
 * The initials of a name - of its first and its last word: "Jan Amos
 * Komenský" is "JK". A word without a letter or a digit (an emoji, "&") has
 * none, and a letter with an accent stays whole, also one written as a
 * letter and a combining mark.
 */
function getInitials(name: string) {
  const initials = name
    .normalize("NFC")
    .split(/\s+/)
    .map((word) =>
      graphemesOf(word).find((grapheme) => /^[\p{L}\p{N}]/u.test(grapheme)),
    )
    .filter((initial) => initial !== undefined);

  return (initials.length > 1 ? [initials[0], initials.at(-1)] : initials)
    .map((initial) => initial?.toUpperCase())
    .join("");
}

/**
 * A profile picture, the initials of `name`, or a generic user icon - in
 * that order of preference.
 */
export default function Avatar({
  alt,
  className,
  name,
  size = "sm",
  src,
  status,
  ...props
}: AvatarProps) {
  const messages = useMessages();
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = src && failedSrc !== src;
  const initials = name ? getInitials(name) : "";
  // The avatar stands for the person - named like the picture would be
  const label = alt ?? name;
  const statusText = status && messages.avatar.status[status];
  // One image of the person: the initials or the icon, and a picture with a
  // status - which is part of the name then
  const isNamedImage = !!label && (!showImage || !!statusText);
  const imageLabel = !isNamedImage
    ? undefined
    : statusText
      ? formatMessage(messages.avatar.statusLabel, {
          name: label,
          status: statusText,
        })
      : label;

  return (
    <div
      aria-label={imageLabel}
      role={isNamedImage ? "img" : undefined}
      {...props}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        // The status dot sits on the edge of the circle - nothing may clip it
        status ? "relative" : "overflow-hidden",
        (showImage || initials) && sizeClasses[size],
        initials &&
          !showImage &&
          "bg-primary-100 font-semibold text-primary-700 dark:bg-primary-900 dark:text-primary-200",
        className,
      )}
      // The tooltip says what the name says - a different text would be
      // read once more as the description of the image
      title={props.title ?? imageLabel ?? name}
    >
      {showImage ? (
        <img
          // The name of the whole avatar says it
          alt={isNamedImage ? "" : (alt ?? name ?? "")}
          className={cn("h-full w-full object-cover", status && "rounded-full")}
          onError={() => setFailedSrc(src)}
          src={src}
        />
      ) : initials ? (
        <span aria-hidden={!!name}>{initials}</span>
      ) : (
        <UserCircle aria-hidden="true" size={iconSizes[size]} />
      )}
      {status && (
        <span
          // A decorative avatar still tells the status
          aria-label={isNamedImage ? undefined : statusText}
          className={cn(
            "absolute end-0 bottom-0 rounded-full ring-2 ring-surface dark:ring-surface-dark",
            statusSizeClasses[size],
            statusClasses[status],
          )}
          role={isNamedImage ? undefined : "img"}
          title={statusText}
        />
      )}
    </div>
  );
}
