import { useCallback, useInsertionEffect, useRef, useState } from "react";
import ConfirmDialog from "../components/ui/confirm-dialog";
import PromptDialog from "../components/ui/prompt-dialog";
import isPromiseLike from "../utils/is-promise-like";
import logger from "../utils/logger";
import {
  ConfirmContext,
  PromptContext,
  type ConfirmFunction,
  type ConfirmOptions,
  type PromptFunction,
  type PromptOptions,
} from "./confirm-context";

interface RequestBase {
  /** Tells the dialogs of the questions apart. */
  id: number;
  /**
   * Asked while the `onConfirm` of another question ran - shown above that
   * one's dialog at once, instead of after it.
   */
  nested: boolean;
}

/** A question of `confirm()` or `alert()`. */
interface ConfirmRequest extends RequestBase {
  kind: "confirm";
  /** What to ask. */
  options: ConfirmOptions;
  /** Settles the promise `confirm()` returned. */
  resolve: (confirmed: boolean) => void;
}

/** A question of `prompt()`. */
interface PromptRequest extends RequestBase {
  kind: "prompt";
  /** What to ask. */
  options: PromptOptions;
  /** Settles the promise `prompt()` returned - `null` when cancelled. */
  resolve: (value: string | null) => void;
}

type DialogRequest = ConfirmRequest | PromptRequest;

/** A question before it is queued. */
type NewRequest =
  Omit<ConfirmRequest, "id" | "nested"> | Omit<PromptRequest, "id" | "nested">;

/** Settles a question - confirmed, with the value of a prompt, or not. */
const answer = (request: DialogRequest, confirmed: boolean, value = "") => {
  if (request.kind === "prompt") request.resolve(confirmed ? value : null);
  else request.resolve(confirmed);
};

export interface ConfirmProviderProps {
  /** The app - `useConfirm()`, `useAlert()` and `usePrompt()` work anywhere inside. */
  children: React.ReactNode;
}

const logFailure = (error: unknown) =>
  logger.error(
    "The onConfirm of confirm() failed - the dialog stays open.",
    error,
  );

/**
 * Runs the `onConfirm` of a question: whether the dialog may close - not
 * when it returns `false` or fails. A promise when `onConfirm` returns one.
 * Out here, as the React Compiler cannot compile a try / catch around
 * conditionals.
 */
function runConfirmAction(
  onConfirm: (() => unknown) | undefined,
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
 * Shows the questions asked with `useConfirm()` - the messages of
 * `useAlert()` and the prompts of `usePrompt()` too - in a dialog, one at a
 * time: a question asked while another is open waits for it, one asked from
 * its `onConfirm` is shown above it. Render it once, near the root of the
 * app.
 */
export default function ConfirmProvider({
  children,
}: Readonly<ConfirmProviderProps>) {
  // The questions not answered yet, in the order they were asked - the first
  // is in the dialog, with the questions asked from its `onConfirm` in front
  // of it, shown above it
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  // A question was just answered - the next one waits until its dialog has
  // closed and given the focus back, so the next dialog gives the focus back
  // to the same place, and screen readers announce a new dialog
  const [isBetween, setIsBetween] = useState(false);
  // The questions whose `onConfirm` runs - their dialogs show a spinner
  const [running, setRunning] = useState<ReadonlySet<DialogRequest>>(
    () => new Set(),
  );
  // Every question not settled yet - the provider answers them when it goes
  const pendingRef = useRef(new Set<DialogRequest>());
  // The questions whose `onConfirm` runs - they settle when that is done
  const runningRef = useRef(new Set<DialogRequest>());
  const lastIdRef = useRef(0);
  const mountedRef = useRef(false);
  // Unmounted for good - hiding with Activity keeps the provider alive
  const goneRef = useRef(false);

  // Puts a question in the queue - or, asked from a callback that outlived
  // the provider, answers it at once: nobody can
  const ask = useCallback((request: NewRequest) => {
    const nested = runningRef.current.size > 0;
    lastIdRef.current += 1;
    const queued: DialogRequest = { ...request, id: lastIdRef.current, nested };
    if (goneRef.current) {
      answer(queued, false);
      return;
    }
    pendingRef.current.add(queued);
    setQueue((current) =>
      nested ? [queued, ...current] : [...current, queued],
    );
  }, []);

  const confirm = useCallback<ConfirmFunction>(
    (options) =>
      new Promise<boolean>((resolve) => {
        ask({ kind: "confirm", options, resolve });
      }),
    [ask],
  );

  const prompt = useCallback<PromptFunction>(
    (options) =>
      new Promise<string | null>((resolve) => {
        ask({ kind: "prompt", options, resolve });
      }),
    [ask],
  );

  // Unmounted - nobody can answer the questions any more: they resolve
  // `false` (`null` a prompt), those whose `onConfirm` runs with its
  // outcome, and so do the questions asked from then on. Insertion effects
  // follow the actual lifetime: Activity keeps them while hiding the page,
  // and StrictMode does not replay them. Pending questions stay with the
  // hidden page and can be answered when it is shown again.
  useInsertionEffect(() => {
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
          answer(request, false);
        }
      });
    };
  }, []);

  const settle = (request: DialogRequest, confirmed: boolean, value = "") => {
    pendingRef.current.delete(request);
    answer(request, confirmed, value);
    setQueue((requests) => requests.filter((other) => other !== request));
    // The dialog under a nested question stays - otherwise the dialog closes
    // and gives the focus back in the commit of this update, and a timer
    // runs after it
    if (request.nested) return;
    setIsBetween(true);
    setTimeout(() => setIsBetween(false));
  };

  const setRunningRequest = (request: DialogRequest, isRunning: boolean) =>
    setRunning((current) => {
      const next = new Set(current);
      if (isRunning) next.add(request);
      else next.delete(request);
      return next;
    });

  const handleCancel = (request: DialogRequest) => {
    if (!runningRef.current.has(request)) settle(request, false);
  };

  const handleConfirm = async (request: DialogRequest, value = "") => {
    if (runningRef.current.has(request)) return;

    // Before `onConfirm` runs - a question it asks right away is nested
    runningRef.current.add(request);
    const outcome = runConfirmAction(
      request.kind === "prompt"
        ? request.options.onConfirm &&
            (() => request.options.onConfirm?.(value))
        : request.options.onConfirm,
    );
    if (typeof outcome === "boolean") {
      runningRef.current.delete(request);
      if (outcome) settle(request, true, value);
      return;
    }

    setRunningRequest(request, true);
    const confirmed = await outcome;
    runningRef.current.delete(request);
    setRunningRequest(request, false);

    // Gone meanwhile, the provider cannot keep the question open
    if (confirmed || !mountedRef.current) settle(request, confirmed, value);
  };

  // The shown dialogs, the topmost first: the nested questions and the one
  // they were asked from
  const baseIndex = queue.findIndex((request) => !request.nested);
  const shown = isBetween
    ? []
    : queue.slice(0, baseIndex === -1 ? queue.length : baseIndex + 1);

  return (
    <ConfirmContext value={confirm}>
      <PromptContext value={prompt}>
        {children}

        {[...shown].reverse().map((request) =>
          request.kind === "prompt" ? (
            <PromptDialog
              {...request.options}
              key={request.id}
              loading={running.has(request)}
              onClose={() => handleCancel(request)}
              onConfirm={(value) => handleConfirm(request, value)}
              open
            />
          ) : (
            <ConfirmDialog
              {...request.options}
              key={request.id}
              loading={running.has(request)}
              // An alert is acknowledged however it is closed
              onClose={() =>
                request.options.alert
                  ? handleConfirm(request)
                  : handleCancel(request)
              }
              onConfirm={() => handleConfirm(request)}
              open
            />
          ),
        )}
      </PromptContext>
    </ConfirmContext>
  );
}
