import { useCallback, useEffect, useRef, useState } from "react";
import ConfirmDialog from "../components/confirm-dialog";
import logger from "../utils/logger";
import {
  ConfirmContext,
  type ConfirmFunction,
  type ConfirmOptions,
} from "./confirm-context";

interface ConfirmRequest {
  /** Tells the dialogs of the questions apart. */
  id: number;
  /**
   * Asked while the `onConfirm` of another question ran - shown above that
   * one's dialog at once, instead of after it.
   */
  nested: boolean;
  /** What to ask. */
  options: ConfirmOptions;
  /** Settles the promise `confirm()` returned. */
  resolve: (confirmed: boolean) => void;
}

export interface ConfirmProviderProps {
  /** The app - `useConfirm()` works anywhere inside. */
  children: React.ReactNode;
}

const logFailure = (error: unknown) =>
  logger.error(
    "The onConfirm of confirm() failed - the dialog stays open.",
    error,
  );

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
  typeof (value as PromiseLike<unknown> | null)?.then === "function";

/**
 * Runs the `onConfirm` of a question: whether the dialog may close - not
 * when it returns `false` or fails. A promise when `onConfirm` returns one.
 * Out here, as the React Compiler cannot compile a try / catch around
 * conditionals.
 */
function runConfirmAction(
  onConfirm: ConfirmOptions["onConfirm"],
): boolean | Promise<boolean> {
  let result: unknown;

  try {
    result = onConfirm?.();
  } catch (error) {
    logFailure(error);
    return false;
  }

  if (!isPromiseLike(result)) return result !== false;

  return Promise.resolve(result).then(
    (value) => value !== false,
    (error: unknown) => {
      logFailure(error);
      return false;
    },
  );
}

/**
 * Shows the questions asked with `useConfirm()` in a `ConfirmDialog`, one
 * at a time - a question asked while another is open waits for it, one
 * asked from its `onConfirm` is shown above it. Render it once, near the
 * root of the app.
 */
export default function ConfirmProvider({
  children,
}: Readonly<ConfirmProviderProps>) {
  // The questions not answered yet, in the order they were asked - the first
  // is in the dialog, with the questions asked from its `onConfirm` in front
  // of it, shown above it
  const [queue, setQueue] = useState<ConfirmRequest[]>([]);
  // A question was just answered - the next one waits until its dialog has
  // closed and given the focus back, so the next dialog gives the focus back
  // to the same place, and screen readers announce a new dialog
  const [isBetween, setIsBetween] = useState(false);
  // The questions whose `onConfirm` runs - their dialogs show a spinner
  const [running, setRunning] = useState<ReadonlySet<ConfirmRequest>>(
    () => new Set(),
  );
  // Every question not settled yet - the provider answers them when it goes
  const pendingRef = useRef(new Set<ConfirmRequest>());
  // The questions whose `onConfirm` runs - they settle when that is done
  const runningRef = useRef(new Set<ConfirmRequest>());
  const lastIdRef = useRef(0);
  const mountedRef = useRef(false);
  // Unmounted for good - not only for the unmount StrictMode simulates
  const goneRef = useRef(false);

  const confirm = useCallback<ConfirmFunction>(
    (options) =>
      new Promise<boolean>((resolve) => {
        // Asked from a callback that outlived the provider - nobody can
        // answer it
        if (goneRef.current) {
          resolve(false);
          return;
        }

        const nested = runningRef.current.size > 0;
        lastIdRef.current += 1;
        const request = { id: lastIdRef.current, nested, options, resolve };
        pendingRef.current.add(request);
        setQueue((current) =>
          nested ? [request, ...current] : [...current, request],
        );
      }),
    [],
  );

  // Unmounted - nobody can answer the questions any more: they resolve
  // `false`, those whose `onConfirm` runs with its outcome, and so do the
  // questions asked from then on. Not on the unmount StrictMode simulates,
  // after which the provider is back.
  useEffect(() => {
    mountedRef.current = true;
    const pending = pendingRef.current;
    const runningRequests = runningRef.current;

    return () => {
      mountedRef.current = false;
      queueMicrotask(() => {
        if (mountedRef.current) return;
        goneRef.current = true;
        for (const request of pending) {
          if (runningRequests.has(request)) continue;
          pending.delete(request);
          request.resolve(false);
        }
      });
    };
  }, []);

  const settle = (request: ConfirmRequest, confirmed: boolean) => {
    pendingRef.current.delete(request);
    request.resolve(confirmed);
    setQueue((requests) => requests.filter((other) => other !== request));
    // The dialog under a nested question stays - otherwise the dialog closes
    // and gives the focus back in the commit of this update, and a timer
    // runs after it
    if (request.nested) return;
    setIsBetween(true);
    setTimeout(() => setIsBetween(false));
  };

  const setRunningRequest = (request: ConfirmRequest, isRunning: boolean) =>
    setRunning((current) => {
      const next = new Set(current);
      if (isRunning) next.add(request);
      else next.delete(request);
      return next;
    });

  const handleCancel = (request: ConfirmRequest) => {
    if (!runningRef.current.has(request)) settle(request, false);
  };

  const handleConfirm = async (request: ConfirmRequest) => {
    if (runningRef.current.has(request)) return;

    // Before `onConfirm` runs - a question it asks right away is nested
    runningRef.current.add(request);
    const outcome = runConfirmAction(request.options.onConfirm);
    if (typeof outcome === "boolean") {
      runningRef.current.delete(request);
      if (outcome) settle(request, true);
      return;
    }

    setRunningRequest(request, true);
    const confirmed = await outcome;
    runningRef.current.delete(request);
    setRunningRequest(request, false);

    // Gone meanwhile, the provider cannot keep the question open
    if (confirmed || !mountedRef.current) settle(request, confirmed);
  };

  // The shown dialogs, the topmost first: the nested questions and the one
  // they were asked from
  const baseIndex = queue.findIndex((request) => !request.nested);
  const shown = isBetween
    ? []
    : queue.slice(0, baseIndex === -1 ? queue.length : baseIndex + 1);

  return (
    <ConfirmContext value={confirm}>
      {children}

      {[...shown].reverse().map((request) => (
        <ConfirmDialog
          {...request.options}
          key={request.id}
          loading={running.has(request)}
          onClose={() => handleCancel(request)}
          onConfirm={() => handleConfirm(request)}
          open
        />
      ))}
    </ConfirmContext>
  );
}
