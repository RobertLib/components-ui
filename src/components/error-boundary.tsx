import { Component, type ErrorInfo, type ReactNode } from "react";
import Alert from "./alert";
import Button from "./button";
import logger from "../utils/logger";
import { useMessages } from "../providers/ui-context";

export interface ErrorBoundaryProps {
  /** The content to guard. */
  children: ReactNode;
  /**
   * Rendered instead of the crashed children. A function receives the error
   * and a `reset` that renders the children again. The default fallback
   * shows the message of the error only in development.
   */
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  /** Called with every caught error, e.g. to report it to Sentry. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /**
   * Renders the children again after a crash when any of these values
   * changes - e.g. `[pathname]`, so a link out of a crashed page shows the
   * next one.
   */
  resetKeys?: readonly unknown[];
}

interface ErrorBoundaryState {
  /** What was thrown, as an `Error` - `null` while the children render. */
  error: Error | null;
}

/**
 * What was thrown, as an `Error` - also `throw "text"`, `throw null` or
 * `throw undefined`, which would otherwise pass for "no error". The thrown
 * value is its `cause`.
 */
function toError(thrown: unknown): Error {
  if (thrown instanceof Error) return thrown;

  const message =
    typeof thrown === "string"
      ? thrown
      : typeof thrown === "object" &&
          thrown !== null &&
          "message" in thrown &&
          typeof thrown.message === "string"
        ? thrown.message
        : "";

  return new Error(message, { cause: thrown });
}

const haveKeysChanged = (
  previous: readonly unknown[] = [],
  next: readonly unknown[] = [],
) =>
  previous.length !== next.length ||
  previous.some((key, index) => !Object.is(key, next[index]));

/**
 * Whether the app runs in development - bundlers replace
 * `process.env.NODE_ENV`, like for the logger.
 */
function isDevelopment() {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    // `process` is not defined and nothing replaced it
    return true;
  }
}

function DefaultFallback({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const messages = useMessages();

  return (
    <div className="container mx-auto space-y-4 p-6">
      <Alert type="danger">{messages.errorBoundary.title}</Alert>
      {/* The message may tell of the server (a query, a path) - it is for
          the developer, not the users of the live app */}
      {error.message && isDevelopment() && (
        <p className="font-mono text-sm text-neutral-600 dark:text-neutral-400">
          {error.message}
        </p>
      )}
      <Button onClick={reset}>{messages.errorBoundary.retry}</Button>
    </div>
  );
}

/**
 * Catches render errors of its children and shows a fallback with a
 * "Try again" button instead of a blank page.
 */
export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(thrown: unknown): ErrorBoundaryState {
    return { error: toError(thrown) };
  }

  componentDidCatch(thrown: unknown, errorInfo: ErrorInfo): void {
    const error = this.state.error ?? toError(thrown);

    logger.error("ErrorBoundary caught an error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(
    prevProps: ErrorBoundaryProps,
    prevState: ErrorBoundaryState,
  ): void {
    // An error caught in this very update came with the new keys - only a
    // later change of them resets
    if (
      this.state.error &&
      prevState.error &&
      haveKeysChanged(prevProps.resetKeys, this.props.resetKeys)
    ) {
      this.reset();
    }
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;

    if (error) {
      const { fallback } = this.props;

      if (typeof fallback === "function") return fallback(error, this.reset);
      if (fallback !== undefined) return fallback;

      return <DefaultFallback error={error} reset={this.reset} />;
    }

    return this.props.children;
  }
}
