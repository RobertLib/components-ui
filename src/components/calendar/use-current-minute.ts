import { inTimeZone } from "../../utils/time-zone";
import { useSyncExternalStore } from "react";

const MINUTE = 60_000;

/** Calls `callback` at the start of every minute until it is unsubscribed. */
function subscribeToMinutes(callback: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const schedule = () => {
    // A little past the full minute - a timer may fire a moment early
    timer = setTimeout(
      () => {
        callback();
        schedule();
      },
      MINUTE - (Date.now() % MINUTE) + 20,
    );
  };
  schedule();

  return () => clearTimeout(timer);
}

const subscribeToNothing = () => () => {};

/** The current minute - the same number all through it. */
const getMinute = () => Math.floor(Date.now() / MINUTE);

const getNothing = () => null;

/**
 * The current time, to the minute - a new date at the start of every minute.
 * `null` on the server and while a server-rendered page hydrates (the clock
 * and the time zone of the server may differ from the browser's), and while
 * `enabled` is false - then it runs no timer.
 */
export default function useCurrentMinute(
  enabled = true,
  timeZone?: string,
): Date | null {
  const minute = useSyncExternalStore(
    enabled ? subscribeToMinutes : subscribeToNothing,
    enabled ? getMinute : getNothing,
    getNothing,
  );
  return minute === null
    ? null
    : inTimeZone(new Date(minute * MINUTE), timeZone);
}
