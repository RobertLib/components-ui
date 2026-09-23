import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import cn from "../utils/cn";
import Toast, { type ToastVariant } from "../components/toast";
import {
  SnackbarContext,
  ToastRegionContext,
  type SnackbarOptions,
} from "./snackbar-context";

interface QueuedToast extends SnackbarOptions {
  id: number;
  message: string;
  variant: ToastVariant;
}

/** Renders the toasts queued with `useSnackbar().enqueueSnackbar`. */
export default function SnackbarProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [toasts, setToasts] = useState<QueuedToast[]>([]);
  const nextId = useRef(0);

  const enqueueSnackbar = useCallback(
    (
      message: string,
      variant: ToastVariant = "default",
      options: SnackbarOptions = {},
    ) => {
      setToasts((prev) => {
        if (prev.some((t) => t.message === message && t.variant === variant)) {
          return prev;
        }

        nextId.current += 1;

        return [...prev, { ...options, id: nextId.current, message, variant }];
      });
    },
    [],
  );

  const handleToastClose = (id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const renderToast = (toast: QueuedToast) => (
    <Toast
      duration={toast.duration}
      key={toast.id}
      message={toast.message}
      onClose={() => handleToastClose(toast.id)}
      persist={toast.persist}
      variant={toast.variant}
    />
  );

  const errors = toasts.filter((toast) => toast.variant === "error");
  const others = toasts.filter((toast) => toast.variant !== "error");

  // In a portal above the dialogs (z-50) and popovers: a toast raised from a
  // Dialog shows over its backdrop, and a Dialog's focus trap lets the focus
  // into it (its close button)
  const region = (
    <div
      // FOCUS_TRAP_EXEMPT_ATTRIBUTE of the overlay stack
      data-focus-trap-exempt=""
      className="pointer-events-none fixed top-4 left-1/2 z-60 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col items-center"
    >
      {/* The live regions are there before their toasts - screen readers
          announce what is added to a region, not a region that appears.
          Errors interrupt, the rest waits for a pause. */}
      <ToastRegionContext value>
        <div
          aria-live="assertive"
          className="flex flex-col items-center gap-2.5"
        >
          {errors.map(renderToast)}
        </div>
        <div
          aria-live="polite"
          className={cn(
            "flex flex-col items-center gap-2.5",
            errors.length > 0 && others.length > 0 && "mt-2.5",
          )}
        >
          {others.map(renderToast)}
        </div>
      </ToastRegionContext>
    </div>
  );

  return (
    <SnackbarContext value={{ enqueueSnackbar }}>
      {children}

      {typeof document !== "undefined" && createPortal(region, document.body)}
    </SnackbarContext>
  );
}
