import type { LinkComponentProps } from "./router";

/** The link of the default router adapter - a plain `<a>`. */
export default function DefaultLink({ href, ...props }: LinkComponentProps) {
  return <a href={href} {...props} />;
}
