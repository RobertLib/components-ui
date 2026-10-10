import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import FormDialog, { type FormDialogProps } from "./form-dialog";
import Input from "./input";
import { cs } from "../../i18n/ui/cs";
import UIProvider from "../../providers/ui-provider";

/** A form dialog the test can close, with a name field. */
function NameDialog(
  props: Partial<FormDialogProps> & { onClosed?: () => void },
) {
  const { onClosed, ...rest } = props;
  const [open, setOpen] = useState(true);
  return (
    <FormDialog
      onClose={() => {
        setOpen(false);
        onClosed?.();
      }}
      onSubmit={() => {}}
      open={open}
      submitLabel="Save"
      title="Edit name"
      {...rest}
    >
      <Input label="Name" name="name" />
    </FormDialog>
  );
}

describe("FormDialog", () => {
  it("is a dialog with a form, its error and the buttons of the footer", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <NameDialog
        error="The name is taken."
        errorTitle="Not saved"
        onSubmit={onSubmit}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Edit name" });
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "The name is taken.",
    );
    await user.type(within(dialog).getByLabelText(/Name/), "Jana{Enter}");
    expect(onSubmit).toHaveBeenCalledOnce();
    // The event of the form, its default prevented
    expect(onSubmit.mock.calls[0][0].defaultPrevented).toBe(true);

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("does not submit while it saves or the submit is disabled", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { rerender } = render(<NameDialog onSubmit={onSubmit} saving />);

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close dialog" })).toBeDisabled();

    rerender(<NameDialog onSubmit={onSubmit} submitDisabled />);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits and resets no form of the page it is rendered in", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const onReset = vi.fn();
    const onPageSubmit = vi.fn((event: React.FormEvent) =>
      event.preventDefault(),
    );
    const onPageReset = vi.fn();
    render(
      <form onReset={onPageReset} onSubmit={onPageSubmit}>
        <FormDialog
          formProps={{ onReset }}
          onClose={() => {}}
          onSubmit={onSubmit}
          open
          submitLabel="Save"
          title="Edit name"
        >
          <button type="reset">Reset</button>
        </FormDialog>
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onReset).toHaveBeenCalledOnce();
    expect(onPageSubmit).not.toHaveBeenCalled();
    expect(onPageReset).not.toHaveBeenCalled();
  });

  it("stays open by closeDisabled - also by Cancel", async () => {
    const user = userEvent.setup();
    const onClosed = vi.fn();
    render(<NameDialog closeDisabled onClosed={onClosed} />);

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close dialog" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(onClosed).not.toHaveBeenCalled();
  });

  it("closes by Cancel at once without changes", async () => {
    const user = userEvent.setup();
    const onClosed = vi.fn();
    render(<NameDialog onClosed={onClosed} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClosed).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("asks before it throws away changes - by Cancel, Escape or its close button", async () => {
    const user = userEvent.setup();
    const onClosed = vi.fn();
    render(<NameDialog dirty onClosed={onClosed} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    const question = screen.getByRole("alertdialog", {
      name: "Discard changes?",
    });
    await user.click(
      within(question).getByRole("button", { name: "Keep editing" }),
    );
    expect(onClosed).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Edit name" })).toBeVisible();

    await user.keyboard("{Escape}");
    // Escape closes the question, not the form under it
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(onClosed).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Close dialog" }));
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(onClosed).toHaveBeenCalledOnce();
  });

  it("lets onBeforeClose ask instead", async () => {
    const user = userEvent.setup();
    const onClosed = vi.fn();
    const onBeforeClose = vi.fn(() => false);
    render(
      <NameDialog dirty onBeforeClose={onBeforeClose} onClosed={onClosed} />,
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.keyboard("{Escape}");
    expect(onBeforeClose).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onClosed).not.toHaveBeenCalled();
  });

  it("waits for one answer of onBeforeClose by Cancel and Escape alike", async () => {
    const user = userEvent.setup();
    const onClosed = vi.fn();
    let answer: (close: boolean) => void = () => {};
    const onBeforeClose = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          answer = resolve;
        }),
    );
    render(<NameDialog onBeforeClose={onBeforeClose} onClosed={onClosed} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.keyboard("{Escape}");
    expect(onBeforeClose).toHaveBeenCalledOnce();

    await act(async () => answer(true));
    expect(onClosed).toHaveBeenCalledOnce();
  });

  it("stays open when the answer of onBeforeClose to Cancel fails", async () => {
    const user = userEvent.setup();
    const onClosed = vi.fn();
    const onBeforeClose = vi.fn(() => Promise.reject(new Error("Offline")));
    render(<NameDialog onBeforeClose={onBeforeClose} onClosed={onClosed} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await act(async () => {});
    expect(onClosed).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Edit name" })).toBeVisible();

    // Asked again - it waits for no answer
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onBeforeClose).toHaveBeenCalledTimes(2);
  });

  it("drops the question when its owner closes it", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <FormDialog
        dirty
        onClose={() => {}}
        onSubmit={() => {}}
        open
        submitLabel="Save"
        title="Edit"
      >
        Fields
      </FormDialog>,
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    await act(async () =>
      rerender(
        <FormDialog
          dirty
          onClose={() => {}}
          onSubmit={() => {}}
          open={false}
          submitLabel="Save"
          title="Edit"
        >
          Fields
        </FormDialog>,
      ),
    );
    await act(() => new Promise((resolve) => setTimeout(resolve, 250)));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("speaks the language of the locale", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider locale={cs}>
        <NameDialog dirty />
      </UIProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Zrušit" }));
    expect(
      screen.getByRole("alertdialog", { name: "Zahodit změny?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Pokračovat v úpravách" }),
    ).toBeInTheDocument();
  });
});
