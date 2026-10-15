import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SessionTimeout, { type SessionTimeoutProps } from "./session-timeout";
import UIProvider from "../../providers/ui-provider";
import { cs } from "../../i18n/ui/cs";
import FakeBroadcastChannel from "../../test/fake-broadcast-channel";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const START = new Date(2026, 9, 15, 9, 0, 0).getTime();

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

/** The warning, if shown. */
const warning = () => screen.queryByRole("alertdialog");

/** The live region of the countdown. */
const liveRegion = () =>
  document.querySelector<HTMLElement>("[role='alertdialog'] [aria-live]");

function renderSession(props: Partial<SessionTimeoutProps> = {}) {
  const onTimeout = vi.fn();
  const view = (more: Partial<SessionTimeoutProps> = {}) => (
    <SessionTimeout
      idleTimeout={15 * MINUTE}
      onTimeout={onTimeout}
      warningBefore={2 * MINUTE}
      {...props}
      {...more}
    />
  );
  const result = render(view());
  return {
    ...result,
    onTimeout,
    rerender: (more: Partial<SessionTimeoutProps>) =>
      result.rerender(view(more)),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
  vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  FakeBroadcastChannel.open.clear();
});

describe("SessionTimeout", () => {
  it("warns before the session ends for inactivity, with a countdown", () => {
    renderSession({ onLogout: vi.fn() });

    advance(13 * MINUTE - SECOND);
    expect(warning()).toBeNull();
    advance(SECOND);

    const dialog = screen.getByRole("alertdialog", {
      name: "Your session is about to expire",
    });
    expect(dialog).toHaveAccessibleDescription(
      "You have been inactive for a while. For your security, you will be signed out soon. Time left 2:00",
    );
    expect(screen.getByRole("timer")).toHaveTextContent("2:00");
    // The safe choice has the focus
    expect(
      screen.getByRole("button", { name: "Stay signed in" }),
    ).toHaveFocus();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeVisible();

    advance(5 * SECOND);
    expect(screen.getByRole("timer")).toHaveTextContent("1:55");
  });

  it("announces the time left now and then - not every second", () => {
    renderSession();
    advance(13 * MINUTE);

    // The dialog says it as it opens
    expect(liveRegion()).toHaveTextContent("");
    const said = new Set<string>();
    for (let second = 0; second < 2 * 60 - 1; second += 1) {
      advance(SECOND);
      said.add(liveRegion()!.textContent ?? "");
    }
    expect([...said]).toEqual([
      "",
      "1 minute left",
      "30 seconds left",
      "10 seconds left",
    ]);
  });

  it("ends the session when the time runs out", () => {
    const { onTimeout } = renderSession();

    advance(15 * MINUTE - 1);
    expect(onTimeout).not.toHaveBeenCalled();
    advance(SECOND);
    expect(onTimeout).toHaveBeenCalledWith({ fromOtherTab: false });
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(warning()).toBeNull();

    // Nothing more for the ended session
    advance(60 * MINUTE);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(warning()).toBeNull();
  });

  it("is postponed by activity before the warning - not during it", () => {
    const { onTimeout } = renderSession();

    advance(10 * MINUTE);
    act(() => {
      fireEvent.keyDown(document.body, { key: "a" });
    });
    advance(12 * MINUTE);
    expect(warning()).toBeNull();
    advance(MINUTE);
    expect(warning()).not.toBeNull();

    // Moving the mouse is not staying
    act(() => {
      fireEvent.mouseMove(document.body);
    });
    advance(2 * MINUTE);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("keeps the user signed in - the inactivity counts anew", () => {
    const { onTimeout } = renderSession();

    advance(13 * MINUTE);
    fireEvent.click(screen.getByRole("button", { name: "Stay signed in" }));
    expect(warning()).toBeNull();

    advance(13 * MINUTE - SECOND);
    expect(warning()).toBeNull();
    advance(SECOND);
    expect(warning()).not.toBeNull();
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("stays on Escape too", () => {
    const onExtend = vi.fn();
    renderSession({ onExtend });

    advance(13 * MINUTE);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(onExtend).toHaveBeenCalledTimes(1);
    expect(warning()).toBeNull();
  });

  it("waits for an async onExtend - and takes the new expiresAt", async () => {
    let finish!: (value: Date) => void;
    const onExtend = vi.fn(
      () => new Promise<Date>((resolve) => (finish = resolve)),
    );
    const { onTimeout } = renderSession({
      expiresAt: new Date(START + 30 * MINUTE),
      idleTimeout: undefined,
      onExtend,
    });

    advance(28 * MINUTE);
    expect(screen.getByRole("alertdialog")).toHaveAccessibleDescription(
      /Your session is about to expire\./,
    );
    const stay = screen.getByRole("button", { name: "Stay signed in" });
    fireEvent.click(stay);
    expect(stay).toHaveAttribute("aria-busy", "true");
    // Escape does not close it meanwhile
    fireEvent.keyDown(stay, { key: "Escape" });
    expect(onExtend).toHaveBeenCalledTimes(1);

    await act(async () => finish(new Date(START + 60 * MINUTE)));
    expect(warning()).toBeNull();

    advance(29 * MINUTE);
    expect(warning()).toBeNull();
    advance(MINUTE);
    expect(warning()).not.toBeNull();
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("keeps the warning with an error when onExtend fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onExtend = vi
      .fn()
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce(undefined);
    renderSession({ onExtend });

    advance(13 * MINUTE);
    fireEvent.click(screen.getByRole("button", { name: "Stay signed in" }));
    await act(async () => {});
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The session could not be extended. Try again.",
    );
    expect(warning()).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Stay signed in" }));
    await act(async () => {});
    expect(warning()).toBeNull();
  });

  it("signs out", () => {
    const onLogout = vi.fn();
    const { onTimeout } = renderSession({ onLogout });

    advance(13 * MINUTE);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onLogout).toHaveBeenCalledWith({ fromOtherTab: false });
    expect(warning()).toBeNull();
    advance(10 * MINUTE);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("offers no sign out without onLogout", () => {
    renderSession();
    advance(13 * MINUTE);

    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  });

  it("warns before expiresAt - a new one takes the warning away", () => {
    const { onTimeout, rerender } = renderSession({
      expiresAt: new Date(START + 10 * MINUTE).toISOString(),
      idleTimeout: undefined,
    });

    advance(8 * MINUTE);
    expect(warning()).toHaveAccessibleDescription(
      "Your session is about to expire. Time left 2:00",
    );

    // Refreshed by the app meanwhile
    rerender({
      expiresAt: new Date(START + 40 * MINUTE).toISOString(),
      idleTimeout: undefined,
    });
    expect(warning()).toBeNull();
    advance(30 * MINUTE);
    expect(warning()).not.toBeNull();
    advance(2 * MINUTE);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("warns by whichever end comes first", () => {
    renderSession({
      expiresAt: START + 60 * MINUTE,
      idleTimeout: 15 * MINUTE,
    });

    advance(13 * MINUTE);
    expect(warning()).toHaveAccessibleDescription(/inactive/);
  });

  it("ends at once - without a warning - when the computer wakes after the end", () => {
    const { onTimeout } = renderSession();

    advance(5 * MINUTE);
    // Asleep for an hour - no timer ran
    vi.setSystemTime(START + 65 * MINUTE);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(onTimeout).toHaveBeenCalledWith({ fromOtherTab: false });
    expect(warning()).toBeNull();
  });

  it("shows the right time left after the tab slept during the warning", () => {
    const { onTimeout } = renderSession();

    advance(13 * MINUTE);
    vi.setSystemTime(START + 14 * MINUTE + 30 * SECOND);
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(screen.getByRole("timer")).toHaveTextContent("0:30");

    vi.setSystemTime(START + 20 * MINUTE);
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("does nothing while disabled - and watches a new session when enabled", () => {
    const { onTimeout, rerender } = renderSession({ enabled: false });

    advance(60 * MINUTE);
    expect(warning()).toBeNull();
    expect(onTimeout).not.toHaveBeenCalled();

    rerender({ enabled: true });
    advance(13 * MINUTE);
    expect(warning()).not.toBeNull();
    advance(2 * MINUTE);
    expect(onTimeout).toHaveBeenCalledTimes(1);

    // Signed in again
    rerender({ enabled: false });
    rerender({ enabled: true });
    advance(13 * MINUTE);
    expect(warning()).not.toBeNull();
  });

  it("speaks Czech", () => {
    render(
      <UIProvider locale={cs}>
        <SessionTimeout
          idleTimeout={15 * MINUTE}
          onLogout={vi.fn()}
          onTimeout={vi.fn()}
          warningBefore={3 * MINUTE}
        />
      </UIProvider>,
    );

    advance(12 * MINUTE);
    expect(
      screen.getByRole("alertdialog", { name: "Brzy budete odhlášeni" }),
    ).toHaveAccessibleDescription(
      "Delší dobu jste nebyli aktivní. Z bezpečnostních důvodů vás brzy odhlásíme. Zbývající čas 3:00",
    );
    expect(
      screen.getByRole("button", { name: "Zůstat přihlášen" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Odhlásit" })).toBeVisible();
    advance(MINUTE);
    expect(liveRegion()).toHaveTextContent("Zbývají 2 minuty");
    advance(MINUTE);
    expect(liveRegion()).toHaveTextContent("Zbývá 1 minuta");
    advance(30 * SECOND);
    expect(liveRegion()).toHaveTextContent("Zbývá 30 sekund");
  });
});

describe("SessionTimeout ending once", () => {
  it("calls onTimeout once under StrictMode, and once when another tab ends too", () => {
    const onTimeout = vi.fn();
    render(
      <StrictMode>
        <SessionTimeout
          idleTimeout={15 * MINUTE}
          onTimeout={onTimeout}
          warningBefore={2 * MINUTE}
        />
      </StrictMode>,
    );
    const otherTab = new FakeBroadcastChannel("components-ui:session");

    advance(13 * MINUTE);
    advance(2 * MINUTE);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    act(() => otherTab.postMessage({ reason: "timeout", type: "ended" }));
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("ends once a session over already under StrictMode", () => {
    const onTimeout = vi.fn();
    render(
      <StrictMode>
        <SessionTimeout expiresAt={START - MINUTE} onTimeout={onTimeout} />
      </StrictMode>,
    );

    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(warning()).toBeNull();
  });
});

describe("SessionTimeout in several tabs", () => {
  /** Two tabs of the app - two instances on one channel. */
  function renderTabs() {
    const first = { onLogout: vi.fn(), onTimeout: vi.fn() };
    const second = { onLogout: vi.fn(), onTimeout: vi.fn() };
    const onExtend = vi.fn();
    render(
      <>
        <SessionTimeout
          idleTimeout={15 * MINUTE}
          onExtend={onExtend}
          title="First tab"
          warningBefore={2 * MINUTE}
          {...first}
        />
        <SessionTimeout
          idleTimeout={15 * MINUTE}
          title="Second tab"
          warningBefore={2 * MINUTE}
          {...second}
        />
      </>,
    );
    return { first, onExtend, second };
  }

  // One is under the other - hidden from screen readers meanwhile
  const dialog = (title: string) =>
    screen.queryByText(title)?.closest<HTMLElement>("[role='alertdialog']") ??
    null;

  it("closes the warning in the other tabs when one stays", () => {
    const { onExtend } = renderTabs();

    advance(13 * MINUTE);
    expect(dialog("First tab")).not.toBeNull();
    expect(dialog("Second tab")).not.toBeNull();

    const stay = screen
      .getAllByRole("button", { hidden: true, name: "Stay signed in" })
      .find(
        (button) =>
          button.closest("[role='alertdialog']") === dialog("First tab"),
      )!;
    fireEvent.click(stay);
    expect(onExtend).toHaveBeenCalledTimes(1);
    expect(dialog("First tab")).toBeNull();
    expect(dialog("Second tab")).toBeNull();

    // Both count the inactivity anew
    advance(13 * MINUTE - SECOND);
    expect(dialog("Second tab")).toBeNull();
  });

  it("ends the other tabs when one signs out", () => {
    const { first, second } = renderTabs();

    advance(13 * MINUTE);
    const signOut = screen
      .getAllByRole("button", { hidden: true, name: "Sign out" })
      .find(
        (button) =>
          button.closest("[role='alertdialog']") === dialog("Second tab"),
      )!;
    fireEvent.click(signOut);

    expect(second.onLogout).toHaveBeenCalledWith({ fromOtherTab: false });
    expect(first.onLogout).toHaveBeenCalledWith({ fromOtherTab: true });
    expect(dialog("First tab")).toBeNull();
    advance(10 * MINUTE);
    expect(first.onTimeout).not.toHaveBeenCalled();
  });

  it("is postponed by the activity of another tab", () => {
    const onTimeout = vi.fn();
    render(
      <SessionTimeout
        idleTimeout={15 * MINUTE}
        onTimeout={onTimeout}
        warningBefore={2 * MINUTE}
      />,
    );
    const otherTab = new FakeBroadcastChannel("components-ui:session:activity");

    advance(12 * MINUTE);
    act(() => otherTab.postMessage({ at: Date.now() }));
    advance(12 * MINUTE);
    expect(warning()).toBeNull();
    advance(MINUTE);
    expect(warning()).not.toBeNull();
  });

  it("follows a timeout of another tab", () => {
    const onTimeout = vi.fn();
    render(
      <SessionTimeout
        idleTimeout={15 * MINUTE}
        onTimeout={onTimeout}
        warningBefore={2 * MINUTE}
      />,
    );
    const otherTab = new FakeBroadcastChannel("components-ui:session");

    act(() => otherTab.postMessage({ reason: "timeout", type: "ended" }));
    expect(onTimeout).toHaveBeenCalledWith({ fromOtherTab: true });
  });

  it("tells the other tabs about its end and a stay with the new expiry", async () => {
    const onExtend = vi.fn(() => START + 90 * MINUTE);
    render(
      <SessionTimeout
        expiresAt={START + 30 * MINUTE}
        onExtend={onExtend}
        onTimeout={vi.fn()}
        warningBefore={2 * MINUTE}
      />,
    );
    const otherTab = new FakeBroadcastChannel("components-ui:session");
    const received: unknown[] = [];
    otherTab.onmessage = (event) => received.push(event.data);

    advance(28 * MINUTE);
    fireEvent.click(screen.getByRole("button", { name: "Stay signed in" }));
    expect(received).toEqual([
      { type: "extended", until: START + 90 * MINUTE },
    ]);

    advance(60 * MINUTE);
    expect(warning()).not.toBeNull();
    advance(2 * MINUTE);
    expect(received).toContainEqual({ reason: "timeout", type: "ended" });
  });

  it("takes the new expiry a stay in another tab brought", () => {
    const onTimeout = vi.fn();
    render(
      <SessionTimeout
        expiresAt={START + 30 * MINUTE}
        onTimeout={onTimeout}
        warningBefore={2 * MINUTE}
      />,
    );
    const otherTab = new FakeBroadcastChannel("components-ui:session");

    advance(28 * MINUTE);
    expect(warning()).not.toBeNull();
    act(() =>
      otherTab.postMessage({ type: "extended", until: START + 60 * MINUTE }),
    );
    expect(warning()).toBeNull();
    advance(10 * MINUTE);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("shares by localStorage without a BroadcastChannel", () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const onTimeout = vi.fn();
    render(
      <SessionTimeout
        idleTimeout={15 * MINUTE}
        onTimeout={onTimeout}
        syncKey="erp:session"
        warningBefore={2 * MINUTE}
      />,
    );

    advance(13 * MINUTE);
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "erp:session",
          newValue: JSON.stringify({
            message: { type: "extended" },
            sent: "1",
          }),
        }),
      );
    });
    expect(warning()).toBeNull();
  });
});
