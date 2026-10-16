import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import Button from "./button";
import ButtonGroup from "./button-group";
import ContextMenu from "./context-menu";
import Dropdown from "./dropdown";
import IconButton from "./icon-button";
import SplitButton from "./split-button";
import UIProvider from "../../providers/ui-provider";
import type { LinkComponentProps } from "../../providers/router";

const REASON = "Only an accountant can approve invoices.";

afterEach(() => {
  vi.useRealTimers();
});

describe("Button with a disabledReason", () => {
  it("stays focusable, unavailable and described by the reason", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Before</button>
        <Button disabled disabledReason={REASON}>
          Approve
        </Button>
      </>,
    );

    const button = screen.getByRole("button", { name: "Approve" });
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription(REASON);
    expect(button).toHaveClass("cursor-not-allowed");

    await user.tab();
    await user.tab();
    expect(button).toHaveFocus();
    // Keyboard focus shows the reason at once
    expect(screen.getByRole("tooltip")).toHaveTextContent(REASON);
    // Described by the hidden copy - not twice by the tooltip as well
    expect(button.getAttribute("aria-describedby")?.split(" ")).toHaveLength(1);
  });

  it("does nothing on a click, Enter or Space - and nothing around it", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const onRowClick = vi.fn();
    render(
      // A clickable row around it, as in a table
      <div onClick={onRowClick}>
        <Button disabled disabledReason={REASON} onClick={onClick}>
          Approve
        </Button>
      </div>,
    );

    const button = screen.getByRole("button", { name: "Approve" });
    await user.click(button);
    button.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");

    expect(onClick).not.toHaveBeenCalled();
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("shows the reason on a click, and hides it on a press elsewhere", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Button disabled disabledReason={REASON}>
          Approve
        </Button>
        <p>Elsewhere</p>
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent(REASON);

    await user.click(screen.getByText("Elsewhere"));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows the reason on hover after a moment", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <Button disabled disabledReason={REASON}>
        Approve
      </Button>,
    );

    await user.hover(screen.getByRole("button", { name: "Approve" }));
    expect(screen.queryByRole("tooltip")).toBeNull();
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByRole("tooltip")).toHaveTextContent(REASON);

    await user.unhover(screen.getByRole("button", { name: "Approve" }));
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows the reason on a long press, not on a short one", () => {
    vi.useFakeTimers();
    render(
      <Button disabled disabledReason={REASON}>
        Approve
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Approve" });

    fireEvent.pointerDown(button, { pointerType: "touch" });
    act(() => vi.advanceTimersByTime(300));
    fireEvent.pointerUp(button, { pointerType: "touch" });
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.pointerDown(button, { pointerType: "touch" });
    // The long press opens no context menu of the browser
    expect(fireEvent.contextMenu(button)).toBe(false);
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByRole("tooltip")).toHaveTextContent(REASON);
    fireEvent.pointerUp(button, { pointerType: "touch" });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("hides the reason on Escape", async () => {
    const user = userEvent.setup();
    render(
      <Button disabled disabledReason={REASON}>
        Approve
      </Button>,
    );

    await user.tab();
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("submits no form - neither by a click nor by Enter in a field", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <input aria-label="Note" name="note" />
        <Button disabled disabledReason={REASON} type="submit">
          Send
        </Button>
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Send" }));
    await user.type(screen.getByRole("textbox", { name: "Note" }), "x{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("keeps the same element - and the focus - as it is disabled", async () => {
    const user = userEvent.setup();
    const view = (disabled: boolean) => (
      <Button disabled={disabled} disabledReason={REASON}>
        Approve
      </Button>
    );
    const { rerender } = render(view(false));
    const button = screen.getByRole("button", { name: "Approve" });

    await user.tab();
    expect(button).toHaveFocus();
    // Enabled, the reason is not shown or announced
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(button).not.toHaveAttribute("aria-describedby");
    expect(button).not.toHaveAttribute("aria-disabled");

    rerender(view(true));
    expect(screen.getByRole("button", { name: "Approve" })).toBe(button);
    expect(button).toHaveFocus();
    expect(button).toHaveAccessibleDescription(REASON);

    rerender(view(false));
    expect(screen.getByRole("button", { name: "Approve" })).toBe(button);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("keeps its own description", () => {
    render(
      <>
        <p id="hint">Approves the invoice for payment.</p>
        <Button aria-describedby="hint" disabled disabledReason={REASON}>
          Approve
        </Button>
      </>,
    );

    expect(
      screen.getByRole("button", { name: "Approve" }),
    ).toHaveAccessibleDescription(
      `Approves the invoice for payment. ${REASON}`,
    );
  });

  it("is a natively disabled button without a reason - as before", () => {
    render(
      <>
        <Button disabled>Approve</Button>
        <Button disabled disabledReason="">
          Reject
        </Button>
      </>,
    );

    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
    // An empty reason is none
    expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled();
  });

  it("fills the width of its container with fullWidth", () => {
    render(
      <Button disabled disabledReason={REASON} fullWidth>
        Approve
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Approve" });
    expect(button).toHaveClass("w-full");
    expect(button.closest("[data-state]")).toHaveClass("w-full");
  });

  it("is a focusable link without an href, which navigates nowhere", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const RouterLink = ({ href, ...props }: LinkComponentProps) => (
      <a
        {...props}
        href={href}
        onClick={(event) => {
          props.onClick?.(event);
          if (!event.defaultPrevented) navigate(href);
          event.preventDefault();
        }}
      />
    );
    render(
      <UIProvider router={{ Link: RouterLink }}>
        <Button disabled disabledReason={REASON} link="/invoices/7/approve">
          Approve
        </Button>
      </UIProvider>,
    );

    const link = screen.getByRole("link", { name: "Approve" });
    expect(link).not.toHaveAttribute("href");
    expect(link).toHaveAttribute("tabindex", "0");
    expect(link).toHaveAccessibleDescription(REASON);

    await user.tab();
    expect(link).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.click(link);
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("tooltip")).toHaveTextContent(REASON);
  });

  it("keeps the tabIndex given to a link - in a toolbar", () => {
    render(
      <>
        <Button
          disabled
          disabledReason={REASON}
          link="/invoices/7/approve"
          tabIndex={-1}
        >
          Approve
        </Button>
        <IconButton
          aria-label="Edit"
          disabled
          disabledReason={REASON}
          href="/invoices/7/edit"
          tabIndex={-1}
        >
          <svg />
        </IconButton>
      </>,
    );

    expect(screen.getByRole("link", { name: "Approve" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });

  it("works joined in a ButtonGroup", () => {
    render(
      <ButtonGroup aria-label="Invoice">
        <Button>Edit</Button>
        <Button disabled disabledReason={REASON}>
          Approve
        </Button>
      </ButtonGroup>,
    );

    // The last of the group - its outer corners are round
    expect(screen.getByRole("button", { name: "Approve" })).toHaveClass(
      "rounded-e-md",
    );
  });

  it("fills the column of a vertical ButtonGroup as the others do", () => {
    render(
      <ButtonGroup aria-label="Invoice" orientation="vertical">
        <Button>Edit the invoice</Button>
        <Button disabled disabledReason={REASON}>
          Approve
        </Button>
      </ButtonGroup>,
    );

    // The wrapper of the tooltip is stretched - the button fills it
    expect(screen.getByRole("button", { name: "Approve" })).toHaveClass("grow");
    expect(
      screen.getByRole("button", { name: "Edit the invoice" }),
    ).not.toHaveClass("grow");
  });
});

describe("IconButton with a disabledReason", () => {
  it("shows its name and the reason - named by the label, described by the reason", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <IconButton
        aria-label="Delete"
        disabled
        disabledReason="The invoice is paid."
        onClick={onClick}
        tooltip
      >
        <svg />
      </IconButton>,
    );

    const button = screen.getByRole("button", { name: "Delete" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("The invoice is paid.");

    await user.tab();
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Delete");
    expect(tooltip).toHaveTextContent("The invoice is paid.");

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("shows only its label while enabled", async () => {
    const user = userEvent.setup();
    render(
      <IconButton
        aria-label="Delete"
        disabledReason="The invoice is paid."
        tooltip
      >
        <svg />
      </IconButton>,
    );

    await user.tab();
    expect(screen.getByRole("tooltip")).toHaveTextContent(/^Delete$/);
    expect(
      screen.getByRole("button", { name: "Delete" }),
    ).not.toHaveAccessibleDescription();
  });

  it("is a focusable link without an href while disabled", () => {
    render(
      <IconButton
        aria-label="Edit"
        disabled
        disabledReason="The invoice is locked."
        href="/invoices/7/edit"
      >
        <svg />
      </IconButton>,
    );

    const link = screen.getByRole("link", { name: "Edit" });
    expect(link).not.toHaveAttribute("href");
    expect(link).toHaveAttribute("tabindex", "0");
    expect(link).toHaveAccessibleDescription("The invoice is locked.");
  });
});

describe("SplitButton with a disabledReason", () => {
  it("explains both buttons - the menu does not open", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <SplitButton
        disabled
        disabledReason={REASON}
        items={[{ label: "Approve and send", onClick }]}
        onClick={onClick}
      >
        Approve
      </SplitButton>,
    );

    const main = screen.getByRole("button", { name: "Approve" });
    const toggle = screen.getByRole("button", { name: "More options" });
    expect(main).toHaveAccessibleDescription(REASON);
    expect(toggle).toHaveAccessibleDescription(REASON);

    await user.click(main);
    await user.click(toggle);
    toggle.focus();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");
    await user.keyboard(" ");

    expect(screen.queryByRole("menu")).toBeNull();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(onClick).not.toHaveBeenCalled();
  });

  it("stretches the main button with fullWidth - in the wrapper of its tooltip", () => {
    render(
      <SplitButton
        disabled
        disabledReason={REASON}
        fullWidth
        items={[{ label: "Approve and send" }]}
      >
        Approve
      </SplitButton>,
    );

    // The main button takes the room the menu button leaves - also in the
    // wrapper of its tooltip, the item of the row
    const main = screen.getByRole("button", { name: "Approve" });
    expect(main).toHaveClass("flex-1");
    const wrapper = main.closest("[data-state]")!;
    expect(wrapper.parentElement).toHaveAttribute("role", "group");
    expect(wrapper).toHaveClass("w-full");
  });

  it("gives no reason while it only loads", () => {
    render(
      <SplitButton
        disabledReason={REASON}
        items={[{ label: "Approve and send" }]}
        loading
      >
        Approve
      </SplitButton>,
    );

    expect(
      screen.getByRole("button", { name: "More options" }),
    ).not.toHaveAccessibleDescription();
    expect(screen.getByRole("button", { name: "More options" })).toBeDisabled();
  });
});

describe("Menu items with a disabledReason", () => {
  it("show the reason under the label and cannot be picked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <Dropdown
        aria-label="Actions"
        items={[
          { label: "Edit", disabledReason: "Never shown" },
          {
            description: "Removes the user for good",
            disabled: true,
            disabledReason: "Only an administrator can delete users.",
            label: "Delete",
            onClick: onDelete,
          },
        ]}
        trigger={<span>…</span>}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Actions" }));
    const remove = screen.getByRole("menuitem", { name: "Delete" });
    expect(remove).toHaveAttribute("aria-disabled", "true");
    expect(remove).toHaveAccessibleDescription(
      "Removes the user for good Only an administrator can delete users.",
    );
    // The reason is in full contrast, the rest of the item faded
    const reason = screen.getByText("Only an administrator can delete users.");
    expect(remove).not.toHaveClass("opacity-50");
    expect(reason).not.toHaveClass("opacity-50");
    expect(screen.getByText("Delete")).toHaveClass("opacity-50");

    // Enabled, the reason is not shown
    expect(screen.queryByText("Never shown")).toBeNull();
    expect(
      screen.getByRole("menuitem", { name: "Edit" }),
    ).not.toHaveAccessibleDescription();

    await user.click(remove);
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("explain radio options too", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Dropdown
        aria-label="Sort"
        items={[
          {
            onChange,
            options: [
              { label: "Name", value: "name" },
              {
                disabled: true,
                disabledReason: "The list has no prices.",
                label: "Price",
                value: "price",
              },
            ],
            type: "radio",
            value: "name",
          },
        ]}
        trigger={<span>Sort</span>}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Sort" }));
    const price = screen.getByRole("menuitemradio", { name: "Price" });
    expect(price).toHaveAccessibleDescription("The list has no prices.");
    await user.click(price);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("explain the items of a ContextMenu", async () => {
    const user = userEvent.setup();
    render(
      <ContextMenu
        items={[
          {
            disabled: true,
            disabledReason: "The order is shipped.",
            label: "Cancel order",
          },
        ]}
      >
        <div>Order 1042</div>
      </ContextMenu>,
    );

    await user.pointer({
      keys: "[MouseRight]",
      target: screen.getByText("Order 1042"),
    });
    expect(
      screen.getByRole("menuitem", { name: "Cancel order" }),
    ).toHaveAccessibleDescription("The order is shipped.");
  });
});
