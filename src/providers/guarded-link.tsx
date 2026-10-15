import { use } from "react";
import DefaultLink from "./default-link";
import {
  confirmLeave,
  hasUnsavedChanges,
  leavesPage,
} from "./navigation-guard";
import type { LinkComponentProps } from "./router";
import { RouterLinkContext } from "./router-link-context";

const pageLocation = () => null;

/**
 * Whether a click keeps the page - it opens the link in another tab or
 * window (the middle button, Ctrl, Cmd, Shift, a `target`) or downloads it
 * (Alt, `download`).
 */
function keepsPage(event: React.MouseEvent<HTMLAnchorElement>) {
  const anchor = event.currentTarget;
  return (
    event.button !== 0 ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    (!!anchor.target && anchor.target !== "_self") ||
    anchor.hasAttribute("download")
  );
}

/**
 * The `Link` of `useRouter()` - the one of the router adapter, asking
 * "Leave without saving?" before a click leaves a form with unsaved changes
 * (`useUnsavedChanges`). A handler of the link that prevents the default
 * keeps the page without a question.
 */
export default function GuardedLink({ onClick, ...props }: LinkComponentProps) {
  const router = use(RouterLinkContext);
  const RouterLink = router?.Link ?? DefaultLink;

  return (
    <RouterLink
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          !hasUnsavedChanges() ||
          keepsPage(event) ||
          !leavesPage(props.href, (router?.getLocation ?? pageLocation)())
        ) {
          return;
        }

        event.preventDefault();
        const anchor = event.currentTarget;
        void confirmLeave().then((leave) => {
          if (!leave) return;
          // The click again - the router follows the link as it would have.
          // A link gone meanwhile (in a menu that closed) through the router,
          // or the browser.
          if (anchor.isConnected) anchor.click();
          else if (router?.navigate) router.navigate(props.href);
          else window.location.assign(anchor.href);
        });
      }}
    />
  );
}
