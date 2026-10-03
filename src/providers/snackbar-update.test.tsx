import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SnackbarProvider, {
  type SnackbarProviderProps,
} from "./snackbar-provider";
import {
  useSnackbar,
  type SnackbarApi,
  type SnackbarId,
  type SnackbarPosition,
} from "./snackbar-context";
import { LIVE_REGION_DELAY } from "../components/ui/toast";

/** Hands the API `useSnackbar()` returns to `onApi`. */
function Capture({ onApi }: { onApi: (api: SnackbarApi) => void }) {
  const api = useSnackbar();
  useEffect(() => onApi(api), [api, onApi]);
  return null;
}

function renderWithApi(props?: Partial<SnackbarProviderProps>) {
  let api!: SnackbarApi;
  const result = render(
    <SnackbarProvider {...props}>
      <Capture
        onApi={(value) => {
          api = value;
        }}
      />
    </SnackbarProvider>,
  );
  return { ...result, api: () => api };
}

const region = () =>
  document.querySelector<HTMLElement>("[data-focus-trap-exempt]")!;
const assertive = () => document.querySelector("[aria-live='assertive']")!;
const toastOf = (text: string) =>
  screen.getByText(text).closest<HTMLElement>("[data-toast]")!;

afterEach(() => {
  vi.useRealTimers();
});

describe("SnackbarProvider position", () => {
  it("shows the toasts at the top center by default", () => {
    const { api } = renderWithApi();
    act(() => {
      api().enqueueSnackbar("Saved", "success");
    });

    expect(region()).toHaveAttribute("data-position", "top-center");
    expect(region()).toHaveClass("top-4", "mx-auto", "items-center");
    expect(toastOf("Saved")).toHaveClass("animate-slide-down");
  });

  it.each([
    ["top-start", "top-4", "sm:ms-0", "sm:items-start"],
    ["top-end", "top-4", "sm:me-0", "sm:items-end"],
    ["bottom-start", "bottom-4", "sm:ms-0", "sm:items-start"],
    ["bottom-center", "bottom-4", "mx-auto", "items-center"],
    ["bottom-end", "bottom-4", "sm:me-0", "sm:items-end"],
  ] as [SnackbarPosition, string, string, string][])(
    "puts the region %s - centered on phones",
    (position, edge, margin, items) => {
      renderWithApi({ position });
      expect(region()).toHaveClass(edge, margin, items);
      // Centered, as wide as the screen, below the sm breakpoint
      expect(region()).toHaveClass("inset-x-4", "mx-auto", "items-center");
    },
  );

  it("slides the toasts in from the bottom edge and back out to it", () => {
    vi.useFakeTimers();
    const { api } = renderWithApi({ position: "bottom-end" });
    let id!: SnackbarId;
    act(() => {
      id = api().enqueueSnackbar("Saved", "success");
    });

    expect(toastOf("Saved")).toHaveClass("animate-slide-in-up");
    act(() => api().closeSnackbar(id));
    expect(toastOf("Saved")).toHaveClass("animate-slide-out-down");
  });
});

describe("The danger variant", () => {
  it("is announced at once, and error is the same", () => {
    const { api } = renderWithApi();
    let danger!: SnackbarId;
    let error!: SnackbarId;
    act(() => {
      danger = api().enqueueSnackbar("Upload failed", "danger");
      // The old name still works - and is the same toast
      error = api().enqueueSnackbar("Upload failed", "error");
    });

    expect(error).toBe(danger);
    expect(assertive()).toContainElement(toastOf("Upload failed"));
    expect(toastOf("Upload failed")).toHaveClass("bg-danger-50");
  });
});

describe("A message that is a React node", () => {
  it("is shown - and deduplicated only as the same element", () => {
    const { api } = renderWithApi();
    const message = <strong>Saved</strong>;
    let first!: SnackbarId;
    let again!: SnackbarId;
    let other!: SnackbarId;
    act(() => {
      first = api().enqueueSnackbar(message, "success");
      again = api().enqueueSnackbar(message, "success");
      other = api().enqueueSnackbar(<strong>Saved</strong>, "success");
    });

    expect(again).toBe(first);
    expect(other).not.toBe(first);
    expect(screen.getAllByText("Saved")).toHaveLength(2);
    expect(screen.getAllByText("Saved")[0].tagName).toBe("STRONG");
  });
});

describe("updateSnackbar", () => {
  it("changes the message in place", () => {
    const { api } = renderWithApi();
    let id!: SnackbarId;
    act(() => {
      id = api().enqueueSnackbar("Uploading… 10 %");
    });
    const toast = toastOf("Uploading… 10 %");

    act(() => api().updateSnackbar(id, "Uploading… 60 %"));
    expect(toast).toHaveTextContent("Uploading… 60 %");
    // The same toast, in its live region - screen readers read the change
    expect(toastOf("Uploading… 60 %")).toBe(toast);
  });

  it("changes the fields it is given and keeps the others", () => {
    const { api } = renderWithApi();
    let id!: SnackbarId;
    act(() => {
      id = api().enqueueSnackbar("Uploading", "default", {
        loading: true,
        title: "report.pdf",
      });
    });
    const toast = toastOf("Uploading");
    expect(toast.querySelector("svg.animate-spin")).not.toBeNull();

    act(() =>
      api().updateSnackbar(id, {
        loading: false,
        message: <em>Uploaded</em>,
        variant: "success",
      }),
    );
    expect(toast).toHaveTextContent("report.pdf");
    expect(screen.getByText("Uploaded").tagName).toBe("EM");
    expect(toast).toHaveClass("bg-success-50");
    expect(toast.querySelector("svg.animate-spin")).toBeNull();

    // A field given as undefined is removed
    act(() => api().updateSnackbar(id, { title: undefined }));
    expect(toast).not.toHaveTextContent("report.pdf");
  });

  it("starts its time on screen over, so the new text can be read", () => {
    vi.useFakeTimers();
    const { api } = renderWithApi();
    let id!: SnackbarId;
    act(() => {
      id = api().enqueueSnackbar("Saving");
    });

    act(() => vi.advanceTimersByTime(2500));
    act(() => api().updateSnackbar(id, "Saved"));
    act(() => vi.advanceTimersByTime(2500));
    expect(toastOf("Saved")).toHaveAttribute("data-toast", "visible");

    act(() => vi.advanceTimersByTime(500));
    expect(toastOf("Saved")).toHaveAttribute("data-toast", "hiding");
  });

  it("keeps a loading toast on screen until it is updated", () => {
    vi.useFakeTimers();
    const { api } = renderWithApi();
    let id!: SnackbarId;
    act(() => {
      id = api().enqueueSnackbar("Uploading", "default", { loading: true });
    });

    act(() => vi.advanceTimersByTime(10_000));
    expect(toastOf("Uploading")).toHaveAttribute("data-toast", "visible");

    act(() => api().updateSnackbar(id, { loading: false }));
    act(() => vi.advanceTimersByTime(3000));
    expect(toastOf("Uploading")).toHaveAttribute("data-toast", "hiding");
  });

  it("leaves a closed toast closed", () => {
    vi.useFakeTimers();
    const { api } = renderWithApi();
    let id!: SnackbarId;
    act(() => {
      id = api().enqueueSnackbar("Saved");
    });
    act(() => api().closeSnackbar(id));
    act(() => api().updateSnackbar(id, "Saved again"));
    expect(screen.queryByText("Saved again")).toBeNull();

    act(() => vi.advanceTimersByTime(300));
    act(() => api().updateSnackbar(id, "Saved again"));
    expect(screen.queryByText("Saved again")).toBeNull();
    expect(screen.queryByText("Saved")).toBeNull();
  });
});

describe("promise with React nodes", () => {
  it("shows node messages and ends an error as danger", async () => {
    vi.useFakeTimers();
    const { api } = renderWithApi();
    const pending = Promise.reject(new Error("offline"));
    act(() => {
      api()
        .promise(pending, {
          error: (error) => <b>{(error as Error).message}</b>,
          loading: <i>Exporting</i>,
        })
        .catch(() => {});
    });
    act(() => vi.advanceTimersByTime(LIVE_REGION_DELAY));
    expect(screen.getByText("Exporting").tagName).toBe("I");

    await act(async () => {
      await pending.catch(() => {});
    });
    expect(screen.getByText("offline").tagName).toBe("B");
    expect(toastOf("offline")).toHaveClass("bg-danger-50");
  });
});
