import { ArrowLeft } from "lucide-react";
import cn from "../utils/cn";
import IconButton from "./icon-button";
import Skeleton from "./skeleton";
import { useMessages, useRouter } from "../providers/ui-context";

export interface HeaderProps extends Omit<
  React.ComponentProps<"div">,
  "title"
> {
  /** Buttons on the right side. */
  actions?: React.ReactNode;
  /** Rendered right next to the title, outside the heading - e.g. a search field. */
  afterTitle?: React.ReactNode;
  /** Shows a back arrow before the title. */
  back?: boolean;
  /** What the back arrow does - goes back in the history by default. */
  onBack?: () => void;
  /** Page title - `null` / `undefined` shows a placeholder while it loads. */
  title: React.ReactNode;
}

/** The heading row of a page: optional back arrow, title and actions. */
export default function Header({
  actions,
  afterTitle,
  back,
  className,
  onBack,
  title,
  ...props
}: HeaderProps) {
  const router = useRouter();
  const messages = useMessages();

  return (
    <div
      {...props}
      className={cn(
        "flex flex-wrap items-center justify-between gap-2.5",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        {back && (
          <IconButton
            aria-label={messages.header.back}
            onClick={onBack ?? router.back}
          >
            <ArrowLeft size={24} />
          </IconButton>
        )}
        <h1 className="text-3xl font-medium">
          {title ?? (
            <Skeleton
              className="bg-neutral-200/70 dark:bg-neutral-800/70"
              height="h-8"
              width="w-[20vw]"
            />
          )}
        </h1>
        {afterTitle}
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}
