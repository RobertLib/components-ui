import { Component, type ErrorInfo, type ReactNode } from "react";
import Alert from "./alert";
import Button from "./button";
import logger from "../utils/logger";
import { useMessages } from "../providers/ui-context";

export interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Rendered instead of the crashed children. A function receives the error
   * and a `reset` that renders the children again.
   */
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  /** Called with every caught error, e.g. to report it to Sentry. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
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
      {error.message && (
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

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error("ErrorBoundary caught an error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
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
