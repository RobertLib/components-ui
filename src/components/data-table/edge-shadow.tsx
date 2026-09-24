import cn from "../../utils/cn";

/**
 * The shadow a pinned edge casts over the columns scrolled under it - an
 * element of its own, as table cells draw no `box-shadow`.
 */
export default function EdgeShadow({ side }: { side?: "left" | "right" }) {
  if (!side) return null;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-y-0 w-2 from-neutral-900/12 to-transparent dark:from-black/60",
        side === "left" ? "-right-2 bg-linear-to-r" : "-left-2 bg-linear-to-l",
      )}
    />
  );
}
