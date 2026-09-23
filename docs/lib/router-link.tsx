import { Link } from "react-router";
import type { LinkComponentProps } from "components-ui";

/**
 * The library's links rendered by React Router - defined once at module
 * level, so its identity never changes (a component created during render
 * would remount every link on each navigation).
 */
export default function RouterLink({ href, ...props }: LinkComponentProps) {
  return <Link to={href} {...props} />;
}
