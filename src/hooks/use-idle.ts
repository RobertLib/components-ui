import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { openTabChannel, type TabChannel } from "../utils/tab-channel";

/** Options of `useIdle`. */
export interface UseIdleOptions {
  /**
   * Watches the activity while `true`. Turned off, `idle` is `false`; turned
   * on again, the time counts from then.
   * @default true
   */
  enabled?: boolean;
  /**
   * The events on the page that count as activity.
   * @default ["keydown", "mousemove", "pointerdown", "scroll", "touchstart", "wheel"]
   */
  events?: readonly string[];
  /** Called when the user becomes active again after being idle. */
  onActive?: () => void;
  /** Called when the user has been idle for the `timeout`. */
  onIdle?: () => void;
  /**
   * Shares the activity with the other tabs of the app on this channel - a
   * user working in one tab is not idle in the others. `false` watches this
   * tab only.
   * @default "components-ui:idle"
   */
  syncKey?: string | false;
  /**
   * Counts a burst of events once in this many milliseconds - and tells the
   * other tabs as often.
   * @default 1000
   */
  throttle?: number;
}

/** What `useIdle` returns. */
export interface UseIdleResult {
  /**
   * The time of the last activity, in milliseconds since 1970 - in this tab
   * or another. Read it in an event handler or an effect.
   */
  getLastActive: () => number;
  /** No activity for the `timeout` - in this tab nor another. */
  idle: boolean;
  /** Counts as activity now - also in the other tabs. */
  reset: () => void;
}

/** A message of the channel - the time of an activity in another tab. */
interface ActivityMessage {
  at: number;
}

const DEFAULT_EVENTS = [
  "keydown",
  "mousemove",
  "pointerdown",
  "scroll",
  "touchstart",
  "wheel",
] as const;

// The longest delay of `setTimeout` - a longer one would fire at once
const MAX_DELAY = 2_147_483_647;

/**
 * Whether the user has done nothing - no key, pointer, touch, wheel or
 * scroll - for `timeout` milliseconds, in this tab or another tab of the
 * app: `const { idle } = useIdle(5 * 60_000)`. The time is measured by the
 * clock, not by timers alone, so a computer woken from sleep or a tab
 * brought back from the background is idle as long as it really was. On
 * the server and before the effects run it is not idle.
 */
export default function useIdle(
  timeout: number,
  {
    enabled = true,
    events = DEFAULT_EVENTS,
    onActive,
    onIdle,
    syncKey = "components-ui:idle",
    throttle = 1000,
  }: UseIdleOptions = {},
): UseIdleResult {
  const [idle, setIdle] = useState(false);
  // The time of the last activity - 0 until the watching starts
  const lastActiveRef = useRef(0);
  // What `reset` does - shares the activity while watching
  const resetRef = useRef(() => {
    lastActiveRef.current = Date.now();
  });
  const callbacksRef = useRef({ onActive, onIdle });

  useLayoutEffect(() => {
    callbacksRef.current = { onActive, onIdle };
  });

  // One string - an inline array does not start the watching anew
  const eventTypes = events.join(" ");

  useEffect(() => {
    if (!enabled) return;

    let isIdle = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let channel: TabChannel<ActivityMessage> | undefined;
    lastActiveRef.current = Date.now();

    const schedule = () => {
      clearTimeout(timer);
      const delay = lastActiveRef.current + timeout - Date.now();
      timer = setTimeout(check, Math.min(Math.max(delay, 0), MAX_DELAY));
    };

    // From the clock - a timer fires late after sleep, or in a background
    // tab, but the time is right
    function check() {
      if (Date.now() - lastActiveRef.current < timeout) {
        schedule();
      } else if (!isIdle) {
        isIdle = true;
        setIdle(true);
        callbacksRef.current.onIdle?.();
      }
    }

    const markActive = (at: number, share: boolean) => {
      lastActiveRef.current = Math.max(lastActiveRef.current, at);
      if (share) channel?.post({ at: lastActiveRef.current });
      // An old message of another tab - idle all the same
      if (Date.now() - lastActiveRef.current >= timeout) {
        check();
        return;
      }
      if (isIdle) {
        isIdle = false;
        setIdle(false);
        callbacksRef.current.onActive?.();
      }
      schedule();
    };

    const handleActivity = () => {
      const now = Date.now();
      // A burst of events counts once - but at once after being idle
      if (!isIdle && now - lastActiveRef.current < throttle) return;
      markActive(now, true);
    };

    // Back in the tab, woken from sleep, restored from the back-forward
    // cache - the timers may have waited longer than they were set to
    const handleWake = () => {
      if (document.visibilityState !== "hidden") check();
    };

    if (syncKey) {
      channel = openTabChannel<ActivityMessage>(syncKey, (message) => {
        // A clock of another tab ahead counts as now
        if (typeof message?.at === "number") {
          markActive(Math.min(message.at, Date.now()), false);
        }
      });
    }

    const types = eventTypes.split(" ").filter(Boolean);
    const listenerOptions = { capture: true, passive: true };
    for (const type of types) {
      document.addEventListener(type, handleActivity, listenerOptions);
    }
    document.addEventListener("visibilitychange", handleWake);
    window.addEventListener("focus", handleWake);
    window.addEventListener("pageshow", handleWake);
    resetRef.current = () => markActive(Date.now(), true);
    schedule();

    return () => {
      clearTimeout(timer);
      channel?.close();
      for (const type of types) {
        document.removeEventListener(type, handleActivity, listenerOptions);
      }
      document.removeEventListener("visibilitychange", handleWake);
      window.removeEventListener("focus", handleWake);
      window.removeEventListener("pageshow", handleWake);
      resetRef.current = () => {
        lastActiveRef.current = Date.now();
      };
      // Not idle while not watched - and not idle at once when watched again
      setIdle(false);
    };
  }, [enabled, eventTypes, syncKey, throttle, timeout]);

  const getLastActive = useCallback(() => lastActiveRef.current, []);
  const reset = useCallback(() => resetRef.current(), []);

  return { getLastActive, idle: enabled && idle, reset };
}
