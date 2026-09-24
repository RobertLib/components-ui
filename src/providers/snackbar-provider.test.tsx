import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import SnackbarProvider, {
  type SnackbarProviderProps,
} from "./snackbar-provider";
import {
  useSnackbar,
  type SnackbarApi,
  type SnackbarId,
} from "./snackbar-context";
import Dialog from "../components/dialog";

/** Hands the API `useSnackbar()` returns to `onApi`. */
function Capture({ onApi }: { onApi: (api: SnackbarApi) => void }) {
  const api = useSnackbar();
  useEffect(() => onApi(api), [api, onApi]);
  return null;
}

/** Renders a provider and hands its API to the test. */
function renderWithApi(
  children?: React.ReactNode,
  props?: Partial<SnackbarProviderProps>,
) {
  let api!: SnackbarApi;
  const result = render(
    <SnackbarProvider {...props}>
      <Capture
        onApi={(value) => {
          api = value;
        }}
      />
      {children}
    </SnackbarProvider>,
  );
  return { ...result, api: () => api };
}

const polite = () => document.querySelector("[aria-live='polite']")!;
const assertive = () => document.querySelector("[aria-live='assertive']")!;
const toastOf = (text: string) =>
  screen.getByText(text).closest<HTMLElement>("[data-toast]")!;

describe("enqueueSnackbar", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the id of the toast - the one shown for the same message", () => {
    const { api } = renderWithApi();

    let saved!: SnackbarId;
    let again!: SnackbarId;
    let other!: SnackbarId;
    act(() => {
      saved = api().enqueueSnackbar("Saved", "success");
      again = api().enqueueSnackbar("Saved", "success");
      other = api().enqueueSnackbar("Saved", "info");
    });

    expect(saved).toBe(again);
    expect(other).not.toBe(saved);
    expect(screen.getAllByText("Saved")).toHaveLength(2);
  });

  it("shows a title above the message", () => {
    const { api } = renderWithApi();

    act(() => {
      api().enqueueSnackbar("Invoice 2026-0042 was sent.", "success", {
        title: "Sent",
      });
    });

    const toast = toastOf("Invoice 2026-0042 was sent.");
    expect(toast).toHaveTextContent("SentInvoice 2026-0042 was sent.");
    expect(screen.getByText("Sent")).toHaveClass("font-semibold");
    // Announced with its title
    expect(polite()).toContainElement(toast);
  });

  it("stacks the same message under another title", () => {
    const { api } = renderWithApi();

    act(() => {
      api().enqueueSnackbar("Saved", "success", { title: "Customer" });
      api().enqueueSnackbar("Saved", "success", { title: "Order" });
    });

    expect(screen.getAllByText("Saved")).toHaveLength(2);
  });
});

describe("A toast with an action", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs the action and closes", async () => {
    const user = userEvent.setup();
    const undo = vi.fn();
    const { api } = renderWithApi(<button type="button">Archive</button>);

    const archive = screen.getByRole("button", { name: "Archive" });
    await user.click(archive);
    act(() => {
      api().enqueueSnackbar("The customer was archived", "default", {
        action: { label: "Undo", onClick: undo },
      });
    });

    // Reached from the keyboard: the toast, then its action
    await user.tab();
    await user.tab();
    const undoButton = screen.getByRole("button", { name: "Undo" });
    expect(undoButton).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(undo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("The customer was archived")).toBeNull();
    // The focus goes back to where it was before the toasts
    expect(archive).toHaveFocus();
  });

  it("stays 6 seconds by default", () => {
    vi.useFakeTimers();
    const { api } = renderWithApi();

    act(() => {
      api().enqueueSnackbar("Deleted", "default", {
        action: { label: "Undo", onClick: () => {} },
      });
      api().enqueueSnackbar("Saved", "success");
    });

    // 3 s and the slide-out later
    act(() => vi.advanceTimersByTime(3000));
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByText("Saved")).toBeNull();
    expect(screen.getByText("Deleted")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(2800));
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByText("Deleted")).toBeNull();
  });

  it("is shown for every call - each action is its own", () => {
    const { api } = renderWithApi();
    const undoFirst = vi.fn();

    act(() => {
      api().enqueueSnackbar("Deleted", "default", {
        action: { label: "Undo", onClick: undoFirst },
      });
      api().enqueueSnackbar("Deleted", "default", {
        action: { label: "Undo", onClick: () => {} },
      });
    });

    const undoButtons = screen.getAllByRole("button", { name: "Undo" });
    expect(undoButtons).toHaveLength(2);
    fireEvent.click(undoButtons[0]);
    expect(undoFirst).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("Deleted")).toHaveLength(1);
  });

  it("gives the focus of a dismissed toast to the close button of the next, not its action", async () => {
    const user = userEvent.setup();
    const undo = vi.fn();
    const { api, rerender } = renderWithApi(
      <button type="button">Other</button>,
    );

    act(() => {
      api().enqueueSnackbar("Could not send", "error");
      api().enqueueSnackbar("Deleted", "default", {
        action: { label: "Undo", onClick: undo },
      });
    });
    await user.click(screen.getByRole("button", { name: "Other" }));
    // The error toast first, then its close button
    await user.tab();
    await user.tab();
    // Where the focus came from is gone
    rerender(<SnackbarProvider>{null}</SnackbarProvider>);

    await user.keyboard("{Enter}");
    expect(screen.queryByText("Could not send")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Close notification" }),
    ).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(undo).not.toHaveBeenCalled();
  });
});

describe("closeSnackbar", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("slides out the toast of an id", () => {
    vi.useFakeTimers();
    const { api } = renderWithApi();

    let uploading!: SnackbarId;
    act(() => {
      uploading = api().enqueueSnackbar("Uploading…", "info", {
        persist: true,
      });
      api().enqueueSnackbar("Saved", "success", { persist: true });
    });
    act(() => api().closeSnackbar(uploading));

    const toast = toastOf("Uploading…");
    expect(toast).toHaveClass("animate-slide-up");
    expect(toast).toHaveAttribute("data-toast", "hiding");
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByText("Uploading…")).toBeNull();
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("closes every toast without an id", () => {
    vi.useFakeTimers();
    const { api } = renderWithApi();

    act(() => {
      api().enqueueSnackbar("Saved", "success", { persist: true });
      api().enqueueSnackbar("Failed", "error", { persist: true });
    });
    act(() => api().closeSnackbar());
    act(() => vi.advanceTimersByTime(200));

    expect(screen.queryByText("Saved")).toBeNull();
    expect(screen.queryByText("Failed")).toBeNull();
  });

  it("lets the same message be shown again while it slides out", () => {
    vi.useFakeTimers();
    const { api } = renderWithApi();

    let first!: SnackbarId;
    let second!: SnackbarId;
    act(() => {
      first = api().enqueueSnackbar("Saved", "success", { persist: true });
    });
    act(() => api().closeSnackbar(first));
    act(() => {
      second = api().enqueueSnackbar("Saved", "success");
    });

    expect(second).not.toBe(first);
    expect(screen.getAllByText("Saved")).toHaveLength(2);
  });

  it("gives the focus back from a closed toast", () => {
    vi.useFakeTimers();
    const { api } = renderWithApi(<button type="button">Upload</button>);
    const upload = screen.getByRole("button", { name: "Upload" });

    let id!: SnackbarId;
    act(() => {
      id = api().enqueueSnackbar("Uploading…", "info", { persist: true });
    });
    act(() => upload.focus());
    act(() =>
      screen.getByRole("button", { name: "Close notification" }).focus(),
    );

    act(() => api().closeSnackbar(id));
    act(() => vi.advanceTimersByTime(200));
    expect(upload).toHaveFocus();
  });
});

describe("promise", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("turns one toast from loading into the success message", async () => {
    const { api } = renderWithApi();
    let resolve!: (value: { number: string }) => void;
    const saving = new Promise<{ number: string }>((res) => {
      resolve = res;
    });

    let returned!: Promise<{ number: string }>;
    act(() => {
      returned = api().promise(saving, {
        error: "Could not save",
        loading: "Saving the invoice…",
        success: (invoice) => `Invoice ${invoice.number} was saved`,
      });
    });

    expect(returned).toBe(saving);
    const toast = toastOf("Saving the invoice…");
    // A spinner, and no timer runs meanwhile
    expect(toast.querySelector("svg.animate-spin")).toBeInTheDocument();
    expect(polite()).toContainElement(toast);

    await act(async () => resolve({ number: "2026-0042" }));

    // The same element, changed in place
    expect(toastOf("Invoice 2026-0042 was saved")).toBe(toast);
    expect(toast).toHaveClass("bg-success-50");
    expect(toast.querySelector("svg.animate-spin")).toBeNull();
  });

  it("turns it into the error message in its place", async () => {
    const { api } = renderWithApi();
    let reject!: (error: unknown) => void;
    const saving = new Promise<void>((_, rej) => {
      reject = rej;
    });

    act(() => {
      api()
        .promise(saving, {
          error: (error) => `Could not save: ${(error as Error).message}`,
          loading: "Saving…",
          success: "Saved",
        })
        .catch(() => {});
    });
    const toast = toastOf("Saving…");

    await act(async () => reject(new Error("the server is offline")));

    expect(toastOf("Could not save: the server is offline")).toBe(toast);
    expect(toast).toHaveClass("bg-danger-50");
    // Changed in the polite region, where screen readers announce it
    expect(polite()).toContainElement(toast);
    expect(assertive()).toBeEmptyDOMElement();
  });

  it("hands the rejection on to the caller", async () => {
    const { api } = renderWithApi();
    const failure = new Error("Offline");

    let returned!: Promise<unknown>;
    act(() => {
      returned = api().promise(Promise.reject(failure), {
        error: "Could not save",
        loading: "Saving…",
      });
    });

    await expect(returned).rejects.toBe(failure);
  });

  it("counts its duration from when the promise settles", async () => {
    vi.useFakeTimers();
    const { api } = renderWithApi();
    let resolve!: () => void;

    act(() => {
      api().promise(
        new Promise<void>((res) => {
          resolve = res;
        }),
        { loading: "Exporting…", success: "Exported" },
        { duration: 1000 },
      );
    });
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText("Exporting…")).toBeInTheDocument();

    await act(async () => resolve());
    act(() => vi.advanceTimersByTime(999));
    expect(toastOf("Exported")).toHaveAttribute("data-toast", "visible");
    act(() => vi.advanceTimersByTime(1));
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByText("Exported")).toBeNull();
  });

  it("closes the toast when there is no message for the outcome", async () => {
    vi.useFakeTimers();
    const { api } = renderWithApi();

    act(() => {
      api()
        .promise(Promise.reject(new Error("Invalid")), { loading: "Saving…" })
        .catch(() => {});
    });
    await act(async () => {});
    expect(toastOf("Saving…")).toHaveAttribute("data-toast", "hiding");

    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByText("Saving…")).toBeNull();
  });

  it("stays gone once dismissed while loading", async () => {
    const user = userEvent.setup();
    const { api } = renderWithApi();
    let resolve!: () => void;

    act(() => {
      api().promise(
        new Promise<void>((res) => {
          resolve = res;
        }),
        { loading: "Importing…", success: "Imported" },
      );
    });
    await user.click(
      screen.getByRole("button", { name: "Close notification" }),
    );
    await act(async () => resolve());

    expect(screen.queryByText("Importing…")).toBeNull();
    expect(screen.queryByText("Imported")).toBeNull();
  });

  it("is never merged with another toast of the same text", () => {
    const { api } = renderWithApi();

    act(() => {
      api().promise(new Promise(() => {}), { loading: "Saving…" });
      api().promise(new Promise(() => {}), { loading: "Saving…" });
      api().enqueueSnackbar("Saving…");
    });

    expect(screen.getAllByText("Saving…")).toHaveLength(3);
  });
});

describe("SnackbarProvider maxToasts", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const shownMessages = () =>
    Array.from(document.querySelectorAll("[data-toast]"), (toast) =>
      toast.textContent?.trim(),
    );

  it("shows three toasts at once - the next one waits for its turn", async () => {
    const user = userEvent.setup();
    const { api } = renderWithApi();

    act(() => {
      for (const row of [1, 2, 3, 4]) {
        api().enqueueSnackbar(`Row ${row} failed`, "error", { persist: true });
      }
    });
    expect(shownMessages()).toEqual([
      "Row 1 failed",
      "Row 2 failed",
      "Row 3 failed",
    ]);

    // A dismissed one makes room
    await user.click(
      within(toastOf("Row 1 failed")).getByRole("button", {
        name: "Close notification",
      }),
    );
    expect(shownMessages()).toEqual([
      "Row 2 failed",
      "Row 3 failed",
      "Row 4 failed",
    ]);
  });

  it("starts the time of a waiting toast once it shows", () => {
    vi.useFakeTimers();
    const { api } = renderWithApi(undefined, { maxToasts: 1 });

    let upload!: SnackbarId;
    act(() => {
      upload = api().enqueueSnackbar("Uploading…", "info", { persist: true });
      api().enqueueSnackbar("Saved", "success", { duration: 1000 });
    });
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByText("Saved")).toBeNull();

    // Shown as the other one slides out - for its whole second
    act(() => api().closeSnackbar(upload));
    expect(toastOf("Saved")).toHaveAttribute("data-toast", "visible");
    act(() => vi.advanceTimersByTime(999));
    expect(toastOf("Saved")).toHaveAttribute("data-toast", "visible");
    act(() => vi.advanceTimersByTime(1));
    expect(toastOf("Saved")).toHaveAttribute("data-toast", "hiding");
  });

  it("drops a waiting toast that is closed, and takes Infinity for no limit", () => {
    vi.useFakeTimers();
    const { api, unmount } = renderWithApi(undefined, { maxToasts: 1 });

    let waiting!: SnackbarId;
    act(() => {
      api().enqueueSnackbar("Saved", "success", { persist: true });
      waiting = api().enqueueSnackbar("Sent", "success", { persist: true });
    });
    expect(screen.queryByText("Sent")).toBeNull();
    act(() => api().closeSnackbar(waiting));
    // Dropped - it does not show as the other one goes
    act(() => api().closeSnackbar());
    expect(screen.queryByText("Sent")).toBeNull();
    act(() => vi.advanceTimersByTime(200));
    expect(shownMessages()).toEqual([]);
    unmount();

    const unlimited = renderWithApi(undefined, { maxToasts: Infinity });
    act(() => {
      for (const row of [1, 2, 3, 4, 5]) {
        unlimited.api().enqueueSnackbar(`Row ${row}`, "info");
      }
    });
    expect(shownMessages()).toHaveLength(5);
  });
});

describe("SnackbarProvider in a Dialog", () => {
  it("lets Tab reach the action of a toast from the dialog", async () => {
    const user = userEvent.setup();

    function Notify() {
      const { enqueueSnackbar } = useSnackbar();
      return (
        <Dialog open title="Edit">
          <button
            onClick={() =>
              enqueueSnackbar("Line removed", "default", {
                action: { label: "Undo", onClick: () => {} },
                persist: true,
              })
            }
            type="button"
          >
            Remove line
          </button>
        </Dialog>
      );
    }

    render(
      <SnackbarProvider>
        <Notify />
      </SnackbarProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Remove line" }));
    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "Undo" })).toHaveFocus();
  });
});

describe("useSnackbar without a provider", () => {
  it("shows nothing and returns the promise", async () => {
    let api!: SnackbarApi;
    render(
      <Capture
        onApi={(value) => {
          api = value;
        }}
      />,
    );
    const saving = Promise.resolve(1);

    expect(api.promise(saving, { loading: "Saving…" })).toBe(saving);
    expect(typeof api.enqueueSnackbar("Saved")).toBe("number");
    expect(() => api.closeSnackbar()).not.toThrow();
  });
});

describe("SnackbarProvider on the server", () => {
  it("renders the app, then hydrates without the toasts in its HTML", async () => {
    const app = (
      <SnackbarProvider>
        <p>App</p>
      </SnackbarProvider>
    );

    const html = renderToString(app);
    expect(html).toBe("<p>App</p>");

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();

    const root = await act(async () =>
      hydrateRoot(container, app, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();
    // The live regions are there once it has hydrated
    expect(polite()).toBeInTheDocument();

    act(() => root.unmount());
    container.remove();
  });
});
