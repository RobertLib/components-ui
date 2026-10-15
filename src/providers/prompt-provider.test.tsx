import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import ConfirmProvider from "./confirm-provider";
import {
  useAlert,
  useConfirm,
  usePrompt,
  type PromptFunction,
  type PromptOptions,
} from "./confirm-context";
import PromptDialog from "../components/ui/prompt-dialog";
import UIProvider from "./ui-provider";
import { cs } from "../i18n/ui/cs";

/** A button that asks for a reason and shows the answer. */
function RejectButton({ options }: { options?: Partial<PromptOptions> }) {
  const prompt = usePrompt();
  const [answer, setAnswer] = useState("none");

  return (
    <>
      <button
        onClick={async () => {
          const value = await prompt({
            label: "Reason",
            title: "Reject the invoice?",
            ...options,
          });
          setAnswer(value === null ? "cancelled" : `value: ${value}`);
        }}
        type="button"
      >
        Reject
      </button>
      <output>{answer}</output>
    </>
  );
}

const renderReject = (options?: Partial<PromptOptions>) =>
  render(
    <ConfirmProvider>
      <RejectButton options={options} />
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

describe("usePrompt", () => {
  it("resolves the typed value, trimmed, once confirmed", async () => {
    const user = userEvent.setup();
    renderReject({ message: "The supplier gets the reason by e-mail." });

    await user.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = screen.getByRole("dialog", { name: "Reject the invoice?" });
    expect(dialog).toHaveAccessibleDescription(
      "The supplier gets the reason by e-mail.",
    );
    const field = screen.getByRole("textbox", { name: /Reason/ });
    expect(field).toHaveFocus();

    await user.type(field, "  Wrong VAT rate  ");
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(
      "value: Wrong VAT rate",
    );
    // Back where it was asked from
    expect(screen.getByRole("button", { name: "Reject" })).toHaveFocus();
  });

  it("confirms with Enter in the field", async () => {
    const user = userEvent.setup();
    renderReject();

    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.keyboard("Duplicate{Enter}");

    expect(screen.getByRole("status")).toHaveTextContent("value: Duplicate");
  });

  it.each([
    ["Cancel", () => screen.getByRole("button", { name: "Cancel" })],
    [
      "the close button",
      () => screen.getByRole("button", { name: "Close dialog" }),
    ],
  ])("resolves null on %s", async (_, button) => {
    const user = userEvent.setup();
    renderReject();

    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.keyboard("Something");
    await user.click(button());

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("cancelled");
  });

  it("resolves null on Escape", async () => {
    const user = userEvent.setup();
    renderReject();

    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.keyboard("{Escape}");

    expect(screen.getByRole("status")).toHaveTextContent("cancelled");
  });

  it("starts with the default value selected - typing replaces it", async () => {
    const user = userEvent.setup();
    renderReject({
      defaultValue: "Copy of Invoice 2026-041",
      label: "Name",
      placeholder: "Name of the copy",
      title: "Duplicate the invoice",
    });

    await user.click(screen.getByRole("button", { name: "Reject" }));
    const field = screen.getByRole<HTMLInputElement>("textbox", {
      name: /Name/,
    });
    expect(field).toHaveValue("Copy of Invoice 2026-041");
    expect(field).toHaveAttribute("placeholder", "Name of the copy");
    expect(field.selectionStart).toBe(0);
    expect(field.selectionEnd).toBe(field.value.length);

    await user.keyboard("Invoice 2026-042{Enter}");
    expect(screen.getByRole("status")).toHaveTextContent(
      "value: Invoice 2026-042",
    );
  });

  it("refuses an empty value of a required prompt", async () => {
    const user = userEvent.setup();
    renderReject({ required: true });

    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.keyboard("   {Enter}");

    const field = screen.getByRole("textbox", { name: /Reason/ });
    expect(field).toBeRequired();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription("Fill in this field.");
    expect(field).toHaveFocus();
    expect(screen.getByRole("status", { hidden: true })).toHaveTextContent(
      "none",
    );

    // Typing takes the message away
    await user.keyboard("Late delivery");
    expect(field).not.toHaveAttribute("aria-invalid");
    await user.keyboard("{Enter}");
    expect(screen.getByRole("status")).toHaveTextContent(
      "value: Late delivery",
    );
  });

  it("refuses a default value longer than maxLength", async () => {
    const user = userEvent.setup();
    renderReject({ defaultValue: "Too long a name", maxLength: 5 });

    await user.click(screen.getByRole("button", { name: "Reject" }));
    const field = screen.getByRole("textbox", { name: /Reason/ });
    expect(field).toHaveAttribute("maxlength", "5");
    await user.keyboard("{Enter}");
    expect(field).toHaveAccessibleDescription("Enter at most 5 characters.");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows the message of validate and keeps the dialog open", async () => {
    const user = userEvent.setup();
    const validate = vi.fn((value: string) =>
      value === "Invoice 2026-041" ? "An invoice of this name exists." : null,
    );
    renderReject({ defaultValue: "Invoice 2026-041", validate });

    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.keyboard("{Enter}");
    expect(validate).toHaveBeenCalledWith("Invoice 2026-041");
    expect(
      screen.getByRole("textbox", { name: /Reason/ }),
    ).toHaveAccessibleDescription("An invoice of this name exists.");

    await user.keyboard("Invoice 2026-042{Enter}");
    expect(screen.getByRole("status")).toHaveTextContent(
      "value: Invoice 2026-042",
    );
  });

  it("waits for an async validate with a spinner, the field read-only", async () => {
    const user = userEvent.setup();
    const check = deferred<string | null>();
    renderReject({ validate: () => check.promise });

    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.keyboard("Taken{Enter}");

    const field = screen.getByRole("textbox", { name: /Reason/ });
    const confirm = screen.getByRole("button", { name: "Confirm" });
    expect(confirm).toHaveAttribute("aria-busy", "true");
    expect(field).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    // Escape does not close it meanwhile
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await act(async () => check.resolve("The name is taken."));
    expect(field).not.toHaveAttribute("readonly");
    expect(field).toHaveAccessibleDescription("The name is taken.");
    expect(screen.getByRole("status", { hidden: true })).toHaveTextContent(
      "none",
    );
  });

  it("keeps the dialog open when validate fails", async () => {
    const user = userEvent.setup();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    renderReject({
      validate: () => Promise.reject(new Error("Offline")),
    });

    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.keyboard("Anything{Enter}");

    await waitFor(() =>
      expect(
        screen.getByRole("textbox", { name: /Reason/ }),
      ).not.toHaveAttribute("readonly"),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(error).toHaveBeenCalled();
  });

  it("runs onConfirm with the value - a spinner while it runs", async () => {
    const user = userEvent.setup();
    const request = deferred();
    const onConfirm = vi.fn(() => request.promise);
    renderReject({ onConfirm });

    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.keyboard("Wrong amount{Enter}");

    expect(onConfirm).toHaveBeenCalledWith("Wrong amount");
    expect(screen.getByRole("button", { name: "Confirm" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByRole("status", { hidden: true })).toHaveTextContent(
      "none",
    );

    await act(async () => request.resolve());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("value: Wrong amount");
  });

  it("stays open when onConfirm returns false or rejects", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onConfirm = vi
      .fn()
      .mockReturnValueOnce(false)
      .mockRejectedValueOnce(new Error("Offline"))
      .mockReturnValueOnce(undefined);
    renderReject({ onConfirm });

    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.keyboard("Late{Enter}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Confirm" }),
      ).not.toHaveAttribute("aria-busy"),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(screen.getByRole("status")).toHaveTextContent("value: Late");
  });

  it("asks for several lines - Ctrl + Enter confirms, Enter starts a line", async () => {
    const user = userEvent.setup();
    renderReject({ maxLength: 200, multiline: true });

    await user.click(screen.getByRole("button", { name: "Reject" }));
    const field = screen.getByRole("textbox", { name: /Reason/ });
    expect(field.tagName).toBe("TEXTAREA");
    expect(field).toHaveFocus();

    await user.keyboard("First line{Enter}Second line");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // The counter of the limit
    expect(screen.getByText("22 / 200")).toBeInTheDocument();

    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(screen.getByRole("status")).toHaveTextContent(
      "value: First line Second line",
    );
  });

  it("colors the confirm button and labels the buttons", async () => {
    const user = userEvent.setup();
    renderReject({
      cancelLabel: "Keep",
      confirmColor: "danger",
      confirmLabel: "Reject invoice",
    });

    await user.click(screen.getByRole("button", { name: "Reject" }));
    expect(screen.getByRole("button", { name: "Reject invoice" })).toHaveClass(
      "from-danger-600",
    );
    expect(screen.getByRole("button", { name: "Keep" })).toBeInTheDocument();
  });

  it("names the field by the title without a label", async () => {
    const user = userEvent.setup();
    renderReject({ label: undefined });

    await user.click(screen.getByRole("button", { name: "Reject" }));
    expect(
      screen.getByRole("textbox", { name: "Reject the invoice?" }),
    ).toHaveFocus();
  });

  it("waits in line with the questions of useConfirm and useAlert", async () => {
    const user = userEvent.setup();
    const answers: string[] = [];

    function Asker() {
      const confirm = useConfirm();
      const alert = useAlert();
      const prompt = usePrompt();
      return (
        <button
          onClick={() => {
            void confirm({ title: "First?" }).then((value) =>
              answers.push(`confirm ${value}`),
            );
            void prompt({ title: "Second?" }).then((value) =>
              answers.push(`prompt ${value}`),
            );
            void alert({ title: "Third" }).then(() => answers.push("alert"));
          }}
          type="button"
        >
          Ask
        </button>
      );
    }

    render(
      <ConfirmProvider>
        <Asker />
      </ConfirmProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Ask" }));
    expect(screen.getByRole("alertdialog", { name: "First?" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    const field = await screen.findByRole("textbox", { name: "Second?" });
    await waitFor(() => expect(field).toHaveFocus());
    await user.keyboard("Answer{Enter}");

    await screen.findByRole("alertdialog", { name: "Third" });
    await user.click(screen.getByRole("button", { name: "OK" }));

    await waitFor(() =>
      expect(answers).toEqual(["confirm true", "prompt Answer", "alert"]),
    );
  });

  it("shows a question asked from its onConfirm above it", async () => {
    const user = userEvent.setup();

    function Asker() {
      const confirm = useConfirm();
      const prompt = usePrompt();
      return (
        <button
          onClick={() =>
            void prompt({
              onConfirm: (value) =>
                confirm({ title: `Really reject for "${value}"?` }),
              title: "Reason",
            })
          }
          type="button"
        >
          Ask
        </button>
      );
    }

    render(
      <ConfirmProvider>
        <Asker />
      </ConfirmProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Ask" }));
    await user.keyboard("Late{Enter}");
    // Over the prompt, which waits with its spinner
    expect(
      await screen.findByRole("alertdialog", {
        name: 'Really reject for "Late"?',
      }),
    ).toBeVisible();
    expect(screen.getByDisplayValue("Late")).toHaveAttribute("readonly");
  });

  it("speaks Czech", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider locale={cs}>
        <ConfirmProvider>
          <RejectButton options={{ maxLength: 3, required: true }} />
        </ConfirmProvider>
      </UIProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Reject" }));
    expect(screen.getByRole("button", { name: "Potvrdit" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Zrušit" })).toBeVisible();
    await user.keyboard("{Enter}");
    expect(
      screen.getByRole("textbox", { name: /Reason/ }),
    ).toHaveAccessibleDescription("Vyplňte toto pole.");
  });

  it("tells what is missing without a ConfirmProvider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    function Lonely() {
      usePrompt();
      return null;
    }
    expect(() => render(<Lonely />)).toThrow(/ConfirmProvider/);
  });

  it("answers null a prompt asked after the provider is gone", async () => {
    let ask!: PromptFunction;
    function Capture() {
      const value = usePrompt();
      useEffect(() => {
        ask = value;
      }, [value]);
      return null;
    }
    const { unmount } = render(
      <ConfirmProvider>
        <Capture />
      </ConfirmProvider>,
    );
    unmount();
    await act(async () => {});

    await expect(ask({ title: "Too late" })).resolves.toBeNull();
  });
});

describe("PromptDialog", () => {
  it("starts anew each time it opens", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const view = (open: boolean) => (
      <PromptDialog
        defaultValue="Draft"
        label="Name"
        onClose={() => {}}
        onConfirm={onConfirm}
        open={open}
        required
        title="Rename"
      />
    );
    const { rerender } = render(view(true));

    await user.clear(screen.getByRole("textbox", { name: /Name/ }));
    await user.keyboard("{Enter}");
    expect(onConfirm).not.toHaveBeenCalled();

    rerender(view(false));
    rerender(view(true));
    const field = await screen.findByRole("textbox", { name: /Name/ });
    expect(field).toHaveValue("Draft");
    expect(field).not.toHaveAttribute("aria-invalid");
  });

  it("does not submit a form around it in the React tree", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onConfirm = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <PromptDialog
          label="Name"
          onClose={() => {}}
          onConfirm={onConfirm}
          open
          title="Rename"
        />
      </form>,
    );

    await user.keyboard("New{Enter}");
    expect(onConfirm).toHaveBeenCalledWith("New");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
