/**
 * Whether a `disabledReason` says anything - `cond && reason`, `null` and
 * `""` say nothing. Any reason but `undefined` keeps the tooltip wrapper of
 * a `Button`, so the button stays the same element as it is disabled.
 */
export const hasReason = (reason: React.ReactNode) =>
  reason !== undefined && reason !== null && reason !== false && reason !== "";
