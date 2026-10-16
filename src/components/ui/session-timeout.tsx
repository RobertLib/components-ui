import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import Button from "./button";
import Dialog, { DialogFooter } from "./dialog";
import { formatPlural } from "../../i18n/ui/format";
import type { UIMessages } from "../../i18n/ui/types";
import isPromiseLike from "../../utils/is-promise-like";
import logger from "../../utils/logger";
import { openTabChannel, type TabChannel } from "../../utils/tab-channel";
import useIdle from "../../hooks/use-idle";
import { useLocale } from "../../providers/ui-context";

/** How a session ended - passed to `onTimeout` and `onLogout`. */
export interface SessionEndDetails {
  /**
   * It ended in another tab of the app - this one follows, e.g. to show the
   * sign-in page without asking the server to sign out again.
   */
  fromOtherTab: boolean;
}

/** A moment of `expiresAt` - a `Date`, a timestamp or an ISO string. */
export type SessionTime = Date | number | string;

export interface SessionTimeoutProps extends Omit<
  React.ComponentProps<"div">,
  "children" | "role" | "title"
> {
  /** Classes of the warning dialog. */
  className?: string;
  /**
   * Watches the session while `true` - turn it off while nobody is signed
   * in. Turned on again, a session that ended is watched anew.
   * @default true
   */
  enabled?: boolean;
  /**
   * The events on the page that count as activity for `idleTimeout` - those
   * of `useIdle` by default.
   */
  events?: readonly string[];
  /**
   * When the session ends on the server - e.g. the expiry of the token. A
   * new value (after a refresh of the session) is watched from then on -
   * also by the other tabs, which take an end later than theirs.
   */
  expiresAt?: SessionTime | null;
  /**
   * Inactivity that ends the session, in milliseconds - e.g. `15 * 60_000`.
   * Activity in any tab of the app counts. Leave it out to watch
   * `expiresAt` only.
   */
  idleTimeout?: number;
  /** The text of the warning - by default it says why the session ends. */
  message?: React.ReactNode;
  /**
   * The user chose to stay signed in - "Stay signed in", Escape or the close
   * button: e.g. the request that refreshes the session. It may return (or
   * resolve) the new `expiresAt`. While a returned promise is pending the
   * button shows a spinner; a rejection keeps the warning with an error
   * message, so the user can try again. Without it, staying only restarts
   * the `idleTimeout` - a session that ends at `expiresAt` needs its new
   * end, returned here or given as a new `expiresAt`, or the warning comes
   * back. The other tabs close their warning too.
   */
  onExtend?: () =>
    | SessionTime
    | null
    | undefined
    | void
    | PromiseLike<SessionTime | null | undefined | void>;
  /**
   * The user chose to sign out in the warning - or did in another tab
   * (`fromOtherTab`). Without it the warning has no "Sign out" button.
   */
  onLogout?: (details: SessionEndDetails) => void;
  /**
   * The session ran out - by `idleTimeout` or at `expiresAt`, in this tab
   * or another. Also right away when the computer wakes from sleep after
   * the end: the time is measured by the clock.
   */
  onTimeout: (details: SessionEndDetails) => void;
  /**
   * Shares the activity, a stay, the end of the session on the server
   * (`expiresAt`) and the end with the other tabs of the app on this channel
   * - `false` for this tab only.
   * @default "components-ui:session"
   */
  syncKey?: string | false;
  /** Heading of the warning - the localized "Your session is about to expire". */
  title?: string;
  /**
   * How long before the end of the session the warning shows, in
   * milliseconds - give the user time to come back to the screen.
   * @default 60000
   */
  warningBefore?: number;
}

/** A message between the tabs. */
type SessionMessage =
  | { type: "extended"; until?: number }
  // The end of the session on the server a tab knows - e.g. a new
  // `expiresAt` of its app
  | { type: "expiry"; until: number }
  | { reason: "logout" | "timeout"; type: "ended" };

/** The warning shown - what ends the session, and its first announcement. */
interface Warning {
  /** The end by inactivity as the warning showed - activity does not move it. */
  idleDeadline: number | null;
  /** What the live region would say at once - announced only once it changes. */
  initialAnnouncement: string;
}

// The longest delay of `setTimeout` - a longer one would fire at once
const MAX_DELAY = 2_147_483_647;

const toTime = (value: SessionTime | null | undefined) => {
  if (value === null || value === undefined || value === "") return null;
  const time =
    value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
};

/** The earlier of two moments, either of which may be none. */
const earlier = (a: number | null, b: number | null) =>
  a === null ? b : b === null ? a : Math.min(a, b);

/**
 * What the live region says of the time left - the whole minutes, then 30
 * and 10 seconds: it changes at those moments only, and is announced then.
 */
function announcementFor(
  remaining: number,
  localeCode: string,
  messages: UIMessages["sessionTimeout"],
) {
  const seconds = Math.ceil(remaining / 1000);
  if (seconds > 60) {
    return formatPlural(
      localeCode,
      messages.remainingMinutes,
      Math.ceil(seconds / 60),
    );
  }
  if (seconds > 30) {
    return formatPlural(localeCode, messages.remainingMinutes, 1);
  }
  return formatPlural(
    localeCode,
    messages.remainingSeconds,
    seconds > 10 ? 30 : 10,
  );
}

/** "4:05", "0:09", "1:02:03" - the time left, rounded up to a second. */
function formatCountdown(milliseconds: number) {
  const total = Math.max(Math.ceil(milliseconds / 1000), 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
    : `${minutes}:${seconds}`;
}

type ExtendOutcome = { ok: false } | { ok: true; until: number | null };

const logFailure = (error: unknown) =>
  logger.error(
    "The onExtend of SessionTimeout failed - the warning stays.",
    error,
  );

const toOutcome = (result: unknown): ExtendOutcome => ({
  ok: true,
  until: toTime(result as SessionTime | null | undefined),
});

/**
 * Runs `onExtend` - a promise when it returns one. Out here, as the React
 * Compiler cannot compile a try / catch around conditionals.
 */
function runExtend(
  onExtend: SessionTimeoutProps["onExtend"],
): ExtendOutcome | Promise<ExtendOutcome> {
  let result: unknown;

  try {
    result = onExtend?.();
  } catch (error) {
    logFailure(error);
    return { ok: false };
  }

  if (!isPromiseLike(result)) return toOutcome(result);

  return Promise.resolve(result).then(toOutcome, (error: unknown) => {
    logFailure(error);
    return { ok: false } as const;
  });
}

/**
 * Warns the user before their session ends - after `idleTimeout` of
 * inactivity, at `expiresAt` of the server, or whichever comes first - in
 * an alert dialog `warningBefore` the end, with a countdown, "Stay signed
 * in" (`onExtend`) and "Sign out" (`onLogout`). When the time runs out it
 * closes and calls `onTimeout`. The tabs of the app share the activity, a
 * stay and the end. Render it once, near the root of the app, while the
 * user is signed in. `ref` and the other props go to the dialog window.
 */
export default function SessionTimeout({
  className,
  enabled = true,
  events,
  expiresAt,
  idleTimeout,
  message,
  onExtend,
  onLogout,
  onTimeout,
  syncKey = "components-ui:session",
  title,
  warningBefore = 60_000,
  ...props
}: SessionTimeoutProps) {
  const locale = useLocale();
  const messages = locale.messages.ui.sessionTimeout;
  const messageId = useId();
  const timerId = useId();
  const propExpiry = toTime(expiresAt);

  // A later end a stay brought - in this tab or another - until the app
  // gives a new `expiresAt`
  const [extended, setExtended] = useState<{
    forExpiry: number | null;
    until: number;
  } | null>(null);
  const expiry =
    extended && extended.forExpiry === propExpiry
      ? Math.max(propExpiry ?? extended.until, extended.until)
      : propExpiry;

  const [warning, setWarning] = useState<Warning | null>(null);
  const [ended, setEnded] = useState(false);
  // The clock of the countdown - set as the warning shows, then every second
  const [now, setNow] = useState(0);
  const [extending, setExtending] = useState(false);
  const [extendFailed, setExtendFailed] = useState(false);

  // A new session - turned on again, or a new `expiresAt` - is watched anew
  const sessionKey = `${enabled}:${propExpiry}`;
  const [session, setSession] = useState({ id: 0, key: sessionKey });
  if (sessionKey !== session.key) {
    setSession({ id: session.id + 1, key: sessionKey });
    setEnded(false);
    // A later end a stay brought is that of the last session
    setExtended(null);
  }

  const watching = enabled && !ended;
  const idleChannel = syncKey ? `${syncKey}:activity` : false;
  const { getLastActive, reset } = useIdle(idleTimeout ?? Infinity, {
    enabled: watching && idleTimeout !== undefined,
    events,
    syncKey: idleChannel,
  });

  const channelRef = useRef<TabChannel<SessionMessage> | null>(null);
  // Tells a stay apart from the next one - one that ends after the warning
  // closed otherwise is dropped
  const extendRunRef = useRef(0);
  const latest = useRef({
    expiry,
    onLogout,
    onTimeout,
    propExpiry,
    reset,
    warning,
    watching,
  });

  useLayoutEffect(() => {
    latest.current = {
      expiry,
      onLogout,
      onTimeout,
      propExpiry,
      reset,
      warning,
      watching,
    };
  });

  // The session that ended - a second end of it (told by another tab that
  // ended at the same time, or an effect run again by StrictMode) calls
  // nothing again
  const endedRef = useRef(-1);

  // The end - here, or told by another tab, which needs no message back
  const end = (reason: "logout" | "timeout", fromOtherTab: boolean) => {
    if (endedRef.current === session.id) return;
    endedRef.current = session.id;
    extendRunRef.current += 1;
    setEnded(true);
    setWarning(null);
    setExtending(false);
    setExtendFailed(false);
    if (!fromOtherTab) channelRef.current?.post({ reason, type: "ended" });
    const callback =
      reason === "logout" ? latest.current.onLogout : latest.current.onTimeout;
    callback?.({ fromOtherTab });
  };
  const endRef = useRef(end);

  useLayoutEffect(() => {
    endRef.current = end;
  });

  // The other tabs - a stay closes their warning, an end ends them too
  useEffect(() => {
    if (!enabled || !syncKey) return;

    // An end of the session on the server another tab knows: a later one is
    // taken, an earlier one is told the later end of this tab - a tab that
    // missed a new `expiresAt` must not end the session for all
    const takeEnd = (until: number) => {
      const current = latest.current;
      if (current.expiry === null || current.expiry < until) {
        setExtended({ forExpiry: current.propExpiry, until });
      } else if (current.expiry > until && current.watching) {
        channelRef.current?.post({ type: "expiry", until: current.expiry });
      }
    };

    const channel = openTabChannel<SessionMessage>(syncKey, (received) => {
      if (received?.type === "extended") {
        extendRunRef.current += 1;
        // The inactivity counts from now - before the warning closes and
        // the end is computed again, whatever comes first of the activity
        // of that tab
        latest.current.reset();
        setWarning(null);
        setExtending(false);
        setExtendFailed(false);
        if (typeof received.until === "number") takeEnd(received.until);
      } else if (received?.type === "expiry") {
        if (typeof received.until === "number") takeEnd(received.until);
      } else if (received?.type === "ended") {
        endRef.current(
          received.reason === "logout" ? "logout" : "timeout",
          true,
        );
      }
    });
    channelRef.current = channel;

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [enabled, syncKey]);

  // A new end the app gave - e.g. after a refresh of the session in this tab
  // only: the other tabs take it, or tell a later one of theirs back
  useEffect(() => {
    if (!watching || propExpiry === null) return;
    channelRef.current?.post({ type: "expiry", until: propExpiry });
  }, [propExpiry, watching]);

  // Waits for the moment of the warning - by the clock, so a timer that
  // fires late (sleep, a background tab) or early (activity moved the end)
  // only checks again
  useEffect(() => {
    if (!watching || warning) return;

    let timer: ReturnType<typeof setTimeout> | undefined;

    const check = () => {
      clearTimeout(timer);
      const current = Date.now();
      const idleDeadline =
        idleTimeout === undefined ? null : getLastActive() + idleTimeout;
      const deadline = earlier(idleDeadline, expiry);
      if (deadline === null) return;

      if (current >= deadline) {
        endRef.current("timeout", false);
      } else if (current >= deadline - warningBefore) {
        setNow(current);
        setWarning({
          idleDeadline,
          initialAnnouncement: announcementFor(
            deadline - current,
            locale.code,
            messages,
          ),
        });
      } else {
        timer = setTimeout(
          check,
          Math.min(deadline - warningBefore - current, MAX_DELAY),
        );
      }
    };

    const handleWake = () => {
      if (document.visibilityState !== "hidden") check();
    };

    check();
    document.addEventListener("visibilitychange", handleWake);
    window.addEventListener("focus", handleWake);
    window.addEventListener("pageshow", handleWake);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleWake);
      window.removeEventListener("focus", handleWake);
      window.removeEventListener("pageshow", handleWake);
    };
  }, [
    expiry,
    getLastActive,
    idleTimeout,
    locale.code,
    messages,
    warning,
    warningBefore,
    watching,
  ]);

  // The countdown - its clock every second, at once when the tab is back
  useEffect(() => {
    if (!warning) return;

    const tick = () => setNow(Date.now());
    const handleWake = () => {
      if (document.visibilityState !== "hidden") tick();
    };
    const interval = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", handleWake);
    window.addEventListener("focus", handleWake);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleWake);
      window.removeEventListener("focus", handleWake);
    };
  }, [warning]);

  const deadline = warning ? earlier(warning.idleDeadline, expiry) : null;
  const remaining = deadline === null ? 0 : deadline - now;
  const runsOut = warning !== null && deadline !== null && remaining <= 0;

  // A later end (a new `expiresAt` of the app or of another tab) takes the
  // warning away - with a stay still running, whose outcome is dropped
  if (warning && (deadline === null || remaining > warningBefore)) {
    setWarning(null);
    setExtending(false);
    setExtendFailed(false);
  }

  useEffect(() => {
    if (runsOut) endRef.current("timeout", false);
  }, [runsOut]);

  const completeStay = (until: number | null) => {
    // The inactivity counts from now - in the other tabs too
    reset();
    if (until !== null) setExtended({ forExpiry: propExpiry, until });
    setWarning(null);
    setExtending(false);
    channelRef.current?.post({
      type: "extended",
      until: until ?? undefined,
    });
  };

  const stay = () => {
    if (extending) return;
    setExtendFailed(false);

    const outcome = runExtend(onExtend);
    if (!isPromiseLike(outcome)) {
      if (outcome.ok) completeStay(outcome.until);
      else setExtendFailed(true);
      return;
    }

    extendRunRef.current += 1;
    const run = extendRunRef.current;
    const shownWarning = warning;
    setExtending(true);
    void outcome.then((result) => {
      // Ended, stayed in another tab, or taken away by a later end meanwhile
      if (
        extendRunRef.current !== run ||
        latest.current.warning !== shownWarning
      ) {
        return;
      }
      if (result.ok) {
        completeStay(result.until);
      } else {
        setExtending(false);
        setExtendFailed(true);
      }
    });
  };

  const isIdleWarning =
    warning?.idleDeadline != null &&
    (expiry === null || warning.idleDeadline <= expiry);
  const announcement = warning
    ? announcementFor(remaining, locale.code, messages)
    : "";

  // What the warning shows - kept as it was while the dialog animates out,
  // not "0:00" or the new end of a stay
  const countdown = formatCountdown(remaining);
  const [shown, setShown] = useState({ countdown, idle: isIdleWarning });
  if (
    warning &&
    (shown.countdown !== countdown || shown.idle !== isIdleWarning)
  ) {
    setShown({ countdown, idle: isIdleWarning });
  }

  return (
    <Dialog
      {...props}
      aria-describedby={`${messageId} ${timerId}`}
      className={className}
      closeDisabled={extending}
      // Escape and the close button - the user is here: they stay
      onClose={stay}
      open={warning !== null && !ended}
      role="alertdialog"
      size="sm"
      title={title ?? messages.title}
    >
      <div className="space-y-4">
        <div
          className="text-sm text-neutral-700 dark:text-neutral-300"
          id={messageId}
        >
          {message ??
            (shown.idle ? messages.idleMessage : messages.expiresMessage)}
        </div>

        {/* Read with the message as the dialog opens - not as it ticks */}
        <div className="text-center" id={timerId}>
          <div className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
            {messages.timeLeft}
          </div>
          <div
            className="text-4xl font-semibold text-neutral-900 tabular-nums dark:text-neutral-100"
            role="timer"
          >
            {shown.countdown}
          </div>
        </div>

        {/* The time left, now and then - not every second */}
        <div aria-live="polite" className="sr-only">
          {announcement === warning?.initialAnnouncement ? "" : announcement}
        </div>

        {extendFailed && (
          <p
            className="text-sm text-danger-700 dark:text-danger-400"
            role="alert"
          >
            {messages.extendError}
          </p>
        )}

        <DialogFooter>
          <div className="flex flex-wrap justify-end gap-2">
            {onLogout && (
              <Button
                disabled={extending}
                onClick={() => end("logout", false)}
                variant="outline"
              >
                {messages.logout}
              </Button>
            )}
            <Button
              // The safe choice - Enter keeps the user signed in
              autoFocus
              loading={extending}
              onClick={stay}
            >
              {messages.extend}
            </Button>
          </div>
        </DialogFooter>
      </div>
    </Dialog>
  );
}
