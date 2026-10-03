import cn from "../../../utils/cn";

/**
 * The shadow a pinned edge casts over the columns scrolled under it - an
 * element of its own, as table cells draw no `box-shadow`. `start` is the
 * shadow of the columns pinned to the start, cast towards the end - to the
 * left in a right-to-left table.
 */
export default function EdgeShadow({ side }: { side?: "end" | "start" }) {
  if (!side) return null;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-y-0 w-2 from-neutral-900/12 to-transparent dark:from-black/60",
        // Gradients have no logical directions
        side === "start"
          ? "-inset-e-2 bg-linear-to-r rtl:bg-linear-to-l"
          : "-inset-s-2 bg-linear-to-l rtl:bg-linear-to-r",
      )}
    />
  );
}
