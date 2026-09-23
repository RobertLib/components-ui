import { UserCircle } from "lucide-react";
import { useState } from "react";
import cn from "../utils/cn";

export interface AvatarProps extends React.ComponentProps<"div"> {
  /** Alternative text of the image; defaults to `name`. */
  alt?: string;
  /** Shown as initials when there is no image (or it fails to load). */
  name?: string;
  /** Diameter: 24, 32 or 48 px. */
  size?: "sm" | "md" | "lg";
  /** URL of a profile picture. */
  src?: string;
}

const sizeClasses = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-12 w-12 text-base",
};

const iconSizes = { sm: 24, md: 32, lg: 48 };

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

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
  ...props
}: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = src && failedSrc !== src;
  const initials = name ? getInitials(name) : "";

  return (
    <div
      {...props}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        (showImage || initials) && sizeClasses[size],
        initials &&
          !showImage &&
          "bg-primary-100 font-semibold text-primary-700 dark:bg-primary-900 dark:text-primary-200",
        className,
      )}
      title={props.title ?? name}
    >
      {showImage ? (
        <img
          alt={alt ?? name ?? ""}
          className="h-full w-full object-cover"
          onError={() => setFailedSrc(src)}
          src={src}
        />
      ) : initials ? (
        <span aria-hidden={!!name}>{initials}</span>
      ) : (
        <UserCircle aria-hidden="true" size={iconSizes[size]} />
      )}
    </div>
  );
}
