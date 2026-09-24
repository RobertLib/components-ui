import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode, useEffect, useState } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ConfirmProvider from "./confirm-provider";
import {
  useConfirm,
  type ConfirmFunction,
  type ConfirmOptions,
} from "./confirm-context";
import Sheet from "../components/sheet";

/** A delete button that asks first and shows the answer. */
function DeleteButton({ options }: { options?: Partial<ConfirmOptions> }) {
  const confirm = useConfirm();
  const [answer, setAnswer] = useState("none");

  return (
    <>
      <button
        onClick={async () => {
          const confirmed = await confirm({
            title: "Delete the customer?",
            ...options,
          });
          setAnswer(confirmed ? "confirmed" : "cancelled");
        }}
        type="button"
      >
        Delete
      </button>
      <output>{answer}</output>
    </>
  );
}

const renderDelete = (options?: Partial<ConfirmOptions>) =>
  render(
    <ConfirmProvider>
      <DeleteButton options={options} />
    </ConfirmProvider>,
  );

/** Resolves or rejects when the test says so. */
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, reject, resolve };
}

describe("useConfirm", () => {
  it("resolves true once confirmed", async () => {
    const user = userEvent.setup();
    renderDelete({
      confirmColor: "danger",
      confirmLabel: "Delete",
      message: "The customer and their orders will be deleted.",
    });

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("alertdialog", {
      name: "Delete the customer?",
    });
    expect(dialog).toHaveAccessibleDescription(
      "The customer and their orders will be deleted.",
    );
    // The safe choice has the focus
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();

    await user.click(screen.getAllByRole("button", { name: "Delete" }).at(-1)!);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("confirmed");
  });

  it.each([
    ["Cancel", () => screen.getByRole("button", { name: "Cancel" })],
    [
      "the close button",
      () => screen.getByRole("button", { name: "Close dialog" }),
    ],
  ])("resolves false on %s", async (_, button) => {
    const user = userEvent.setup();
    renderDelete();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(button());

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("cancelled");
    // Back where it was asked from
    expect(screen.getByRole("button", { name: "Delete" })).toHaveFocus();
  });

  it("resolves false on Escape", async () => {
    const user = userEvent.setup();
    renderDelete();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("cancelled");
  });

  it("shows the extra content and the labels of the options", async () => {
    const user = userEvent.setup();
    renderDelete({
      cancelLabel: "Keep",
      children: <textarea aria-label="Reason" />,
      confirmLabel: "Remove",
    });

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByRole("textbox", { name: "Reason" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Keep" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("keeps the dialog open with a spinner while onConfirm runs", async () => {
    const user = userEvent.setup();
    const request = deferred();
    const onConfirm = vi.fn(() => request.promise);
    renderDelete({ confirmLabel: "Remove", onConfirm });

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const remove = screen.getByRole("button", { name: "Remove" });
    expect(remove).toBeDisabled();
    expect(remove).toHaveAttribute("aria-busy", "true");
    // Cannot be cancelled meanwhile
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("none");

    await act(async () => request.resolve());
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("confirmed");
  });

  it("stays open when onConfirm returns false", async () => {
    const user = userEvent.setup();
    renderDelete({ confirmLabel: "Remove", onConfirm: () => false });

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("none");
  });

  it("stays open when onConfirm rejects, so the user can try again", async () => {
    const user = userEvent.setup();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    let attempt = 0;
    const onConfirm = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error("Network error");
    });
    renderDelete({ confirmLabel: "Remove", onConfirm });

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Remove" })).toBeEnabled(),
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("onConfirm"),
      expect.objectContaining({ message: "Network error" }),
    );

    await user.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.getByRole("status")).toHaveTextContent("confirmed");
  });

  it("stays open when onConfirm throws", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderDelete({
      confirmLabel: "Remove",
      onConfirm: () => {
        throw new Error("Invalid state");
      },
    });

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("none");
  });

  it("asks one question at a time, in order", async () => {
    const user = userEvent.setup();
    const answers: [string, boolean][] = [];

    function Bulk() {
      const confirm = useConfirm();
      const ask = async (title: string) =>
        answers.push([title, await confirm({ title })]);

      return (
        <button
          onClick={() => {
            void ask("Delete invoice 1?");
            void ask("Delete invoice 2?");
          }}
          type="button"
        >
          Delete both
        </button>
      );
    }

    render(
      <ConfirmProvider>
        <Bulk />
      </ConfirmProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Delete both" });

    await user.click(trigger);
    expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
    expect(
      screen.getByRole("alertdialog", { name: "Delete invoice 1?" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirm" }));
    // The next one opens once the first has closed
    const second = await screen.findByRole("alertdialog", {
      name: "Delete invoice 2?",
    });
    expect(second).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(answers).toEqual([
      ["Delete invoice 1?", true],
      ["Delete invoice 2?", false],
    ]);
    // Both gave the focus back to where the questions came from
    expect(trigger).toHaveFocus();
  });

  it("opens above a Sheet it is asked from and gives the focus back into it", async () => {
    const user = userEvent.setup();
    const onSheetClose = vi.fn();

    function CustomerSheet() {
      const confirm = useConfirm();
      return (
        <Sheet onClose={onSheetClose} open title="Customer">
          <button
            onClick={() => confirm({ title: "Delete the customer?" })}
            type="button"
          >
            Delete
          </button>
        </Sheet>
      );
    }

    render(
      <ConfirmProvider>
        <CustomerSheet />
      </ConfirmProvider>,
    );
    const remove = screen.getByRole("button", { name: "Delete" });
    await waitFor(() => expect(remove).toHaveFocus());

    await user.click(remove);
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onSheetClose).not.toHaveBeenCalled();
    expect(remove).toHaveFocus();
  });

  it("returns the same function on every render", async () => {
    const user = userEvent.setup();
    const seen = new Set<ConfirmFunction>();

    function Counter() {
      const confirm = useConfirm();
      const [count, setCount] = useState(0);
      seen.add(confirm);
      return (
        <button onClick={() => setCount(count + 1)} type="button">
          {count}
        </button>
      );
    }

    render(
      <ConfirmProvider>
        <Counter />
      </ConfirmProvider>,
    );
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByRole("button"));

    expect(seen.size).toBe(1);
  });

  it("tells what is missing without a ConfirmProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<DeleteButton />)).toThrow(
      /useConfirm\(\) needs a <ConfirmProvider> above it/,
    );
  });
});

describe("ConfirmProvider unmounted", () => {
  it("answers the open and the waiting questions with false", async () => {
    const user = userEvent.setup();
    const answers: boolean[] = [];

    function Ask() {
      const confirm = useConfirm();
      return (
        <button
          onClick={() => {
            void confirm({ title: "First?" }).then((a) => answers.push(a));
            void confirm({ title: "Second?" }).then((a) => answers.push(a));
          }}
          type="button"
        >
          Ask
        </button>
      );
    }

    const { unmount } = render(
      <ConfirmProvider>
        <Ask />
      </ConfirmProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Ask" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    unmount();
    await waitFor(() => expect(answers).toEqual([false, false]));
  });

  it("answers false a question asked after it is gone", async () => {
    let confirm!: ConfirmFunction;

    function Keep() {
      const value = useConfirm();
      useEffect(() => {
        confirm = value;
      }, [value]);
      return null;
    }

    const { unmount } = render(
      <ConfirmProvider>
        <Keep />
      </ConfirmProvider>,
    );
    unmount();
    // A callback that outlived the provider asks later
    await act(async () => {});

    await expect(confirm({ title: "Delete the order?" })).resolves.toBe(false);
  });

  it("answers the question whose onConfirm runs as that ends", async () => {
    const user = userEvent.setup();
    const request = deferred();
    let answer: boolean | undefined;

    function Ask() {
      const confirm = useConfirm();
      return (
        <button
          onClick={async () => {
            answer = await confirm({
              onConfirm: () => request.promise,
              title: "Archive?",
            });
          }}
          type="button"
        >
          Ask
        </button>
      );
    }

    const { unmount } = render(
      <ConfirmProvider>
        <Ask />
      </ConfirmProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Ask" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    unmount();
    await act(() => new Promise((resolve) => setTimeout(resolve)));
    expect(answer).toBeUndefined();

    await act(async () => request.resolve());
    expect(answer).toBe(true);
  });

  it("keeps a question asked on mount under StrictMode", async () => {
    let answer: boolean | undefined;

    function Restore() {
      const confirm = useConfirm();
      useEffect(() => {
        void confirm({ title: "Restore the draft?" }).then((a) => {
          answer = a;
        });
      }, [confirm]);
      return null;
    }

    render(
      <StrictMode>
        <ConfirmProvider>
          <Restore />
        </ConfirmProvider>
      </StrictMode>,
    );

    // StrictMode runs the effect twice - both questions stay open
    await act(() => new Promise((resolve) => setTimeout(resolve)));
    expect(answer).toBeUndefined();
    expect(
      screen.getByRole("alertdialog", { name: "Restore the draft?" }),
    ).toBeInTheDocument();
  });
});

describe("ConfirmProvider on the server", () => {
  it("renders the app", () => {
    const html = renderToString(
      <ConfirmProvider>
        <DeleteButton />
      </ConfirmProvider>,
    );

    expect(html).toContain("Delete");
  });
});

describe("useConfirm from onConfirm", () => {
  it("shows a question asked from onConfirm above the running one", async () => {
    const user = userEvent.setup();

    function DeleteInvoice() {
      const confirm = useConfirm();
      const [answer, setAnswer] = useState("none");

      return (
        <>
          <button
            onClick={async () => {
              const confirmed = await confirm({
                confirmLabel: "Delete invoice",
                // Asks once more before it goes on - the first dialog waits
                onConfirm: () =>
                  confirm({
                    confirmLabel: "Delete payments",
                    title: "Delete its payments too?",
                  }),
                title: "Delete the invoice?",
              });
              setAnswer(confirmed ? "confirmed" : "cancelled");
            }}
            type="button"
          >
            Delete
          </button>
          <output>{answer}</output>
        </>
      );
    }

    render(
      <ConfirmProvider>
        <DeleteInvoice />
      </ConfirmProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete invoice" }));

    // Both dialogs are open - the nested one on top, with the focus
    expect(
      screen.getByRole("alertdialog", { name: "Delete its payments too?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("alertdialog", { name: "Delete the invoice?" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete payments" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("confirmed"),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});
