import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import ConfirmDialog from "./confirm-dialog";
import ConfirmProvider from "../providers/confirm-provider";
import { useAlert, useConfirm } from "../providers/confirm-context";
import UIProvider from "../providers/ui-provider";
import { cs } from "../i18n/cs";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("ConfirmDialog as an alert", () => {
  it("has an OK button only, which has the focus", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        alert
        message="12 invoices were exported."
        onClose={() => {}}
        onConfirm={onConfirm}
        open
        title="Export finished"
      />,
    );
    await act(() => sleep(0));

    const dialog = screen.getByRole("alertdialog", { name: "Export finished" });
    expect(dialog).toHaveAccessibleDescription("12 invoices were exported.");
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    const ok = screen.getByRole("button", { name: "OK" });
    expect(ok).toHaveFocus();

    await userEvent.setup().click(ok);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("takes its button label from the locale, or from confirmLabel", () => {
    const { rerender } = render(
      <UIProvider locale={cs}>
        <ConfirmDialog
          alert
          onClose={() => {}}
          onConfirm={() => {}}
          open
          title="Hotovo"
        />
      </UIProvider>,
    );
    expect(screen.getByRole("button", { name: "OK" })).toBeInTheDocument();

    rerender(
      <UIProvider locale={cs}>
        <ConfirmDialog
          alert
          confirmLabel="Rozumím"
          onClose={() => {}}
          onConfirm={() => {}}
          open
          title="Hotovo"
        />
      </UIProvider>,
    );
    expect(screen.getByRole("button", { name: "Rozumím" })).toBeInTheDocument();
  });
});

describe("ConfirmDialog with confirmationText", () => {
  function DeleteProject({ onConfirm }: { onConfirm: () => void }) {
    const [open, setOpen] = useState(true);
    return (
      <>
        <button onClick={() => setOpen(true)} type="button">
          Delete
        </button>
        <ConfirmDialog
          confirmColor="danger"
          confirmationText="acme-website"
          confirmLabel="Delete the project"
          message="It will be deleted for good."
          onClose={() => setOpen(false)}
          onConfirm={() => {
            onConfirm();
            setOpen(false);
          }}
          open={open}
          title="Delete acme-website?"
        />
      </>
    );
  }

  it("enables the confirm button once the text is typed exactly", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<DeleteProject onConfirm={onConfirm} />);
    await act(() => sleep(0));

    const field = screen.getByRole("textbox", {
      name: "Type acme-website to confirm",
    });
    const confirm = screen.getByRole("button", { name: "Delete the project" });
    // The field has the focus - before the buttons
    expect(field).toHaveFocus();
    expect(confirm).toBeDisabled();

    // The case too
    await user.type(field, "ACME-website");
    expect(confirm).toBeDisabled();
    // Enter does nothing yet
    await user.keyboard("{Enter}");
    expect(onConfirm).not.toHaveBeenCalled();

    await user.clear(field);
    await user.type(field, "acme-website");
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("confirms on Enter in the field once it matches", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<DeleteProject onConfirm={onConfirm} />);
    await act(() => sleep(0));

    await user.keyboard("acme-website{Enter}");
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("is empty again at the next opening", async () => {
    const user = userEvent.setup();
    render(<DeleteProject onConfirm={() => {}} />);
    await act(() => sleep(0));

    await user.keyboard("acme");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByRole("textbox")).toHaveValue("");
  });

  it("says what to type in the active locale, the text in bold", () => {
    render(
      <UIProvider locale={cs}>
        <ConfirmDialog
          confirmationText="acme-website"
          onClose={() => {}}
          onConfirm={() => {}}
          open
          title="Smazat projekt?"
        />
      </UIProvider>,
    );

    expect(
      screen.getByRole("textbox", {
        name: "Pro potvrzení napište acme-website",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("acme-website").tagName).toBe("STRONG");
  });
});

describe("useAlert and confirm({ alert })", () => {
  function Export({ onDone }: { onDone: (value: unknown) => void }) {
    const alert = useAlert();
    const confirm = useConfirm();
    return (
      <>
        <button
          onClick={async () =>
            onDone(await alert({ title: "Export finished" }))
          }
          type="button"
        >
          Export
        </button>
        <button
          onClick={async () =>
            onDone(await confirm({ alert: true, title: "Saved" }))
          }
          type="button"
        >
          Save
        </button>
      </>
    );
  }

  it("resolves once the alert is closed - however it is closed", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(
      <ConfirmProvider>
        <Export onDone={onDone} />
      </ConfirmProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Export" }));
    expect(
      screen.getByRole("alertdialog", { name: "Export finished" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "OK" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(undefined));

    // Escape acknowledges it too - confirm() resolves true
    await user.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("alertdialog", { name: "Saved" });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(onDone).toHaveBeenLastCalledWith(true));
    // The focus goes back to the button that asked
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save" })).toHaveFocus(),
    );
  });
});
