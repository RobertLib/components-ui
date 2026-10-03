import { inTimeZone } from "../utils/time-zone";
import { useCallback, useSyncExternalStore } from "react";
import { shiftDay, startOfDay } from "../utils/date";

// The components showing today - one timer and one pair of listeners for
// all of them
const dayListeners = new Map<() => void, string | undefined>();
let stopWatchingDays: (() => void) | undefined;

/**
 * Tells the listeners to look at the day again: at each midnight, and when
 * the page shows again or gets the focus - a timer waits longer while the
 * device sleeps, and the clock or the time zone may have changed meanwhile.
 */
function watchDays() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const check = () => {
    clearTimeout(timer);
    dayListeners.forEach((_, listener) => listener());
    // A listener may have stopped the watch
    if (stopped) return;
    // A little past the start of the next day - a timer may fire a moment
    // early. A day is 23 or 25 hours long when the clocks change.
    timer = setTimeout(
      check,
      Math.min(
        ...[...dayListeners.values()].map((zone) =>
          shiftDay(inTimeZone(new Date(), zone), 1).getTime(),
        ),
      ) -
        Date.now() +
        20,
    );
  };
  check();

  document.addEventListener("visibilitychange", check);
  window.addEventListener("focus", check);

  return () => {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", check);
    window.removeEventListener("focus", check);
  };
}

function subscribeToDays(callback: () => void, timeZone?: string) {
  dayListeners.set(callback, timeZone);
  stopWatchingDays?.();
  stopWatchingDays = watchDays();

  return () => {
    dayListeners.delete(callback);
    if (dayListeners.size > 0) return;
    stopWatchingDays?.();
    stopWatchingDays = undefined;
  };
}

/** The start of today - the same number all through the day. */
const getDay = (timeZone?: string) =>
  startOfDay(inTimeZone(new Date(), timeZone)).getTime();

const getNothing = () => null;

/**
 * The start of today - a new date when the day changes, also one the
 * device slept through. Runs no timer every minute, unlike
 * `useCurrentMinute`. `null` on the server and while a server-rendered page
 * hydrates, like there.
 */
export default function useToday(timeZone?: string): Date | null {
  const subscribe = useCallback(
    (callback: () => void) => subscribeToDays(callback, timeZone),
    [timeZone],
  );
  const snapshot = useCallback(() => getDay(timeZone), [timeZone]);
  const day = useSyncExternalStore(subscribe, snapshot, getNothing);
  return day === null ? null : inTimeZone(new Date(day), timeZone);
}
