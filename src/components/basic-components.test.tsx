import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import Avatar from "./avatar";
import AvatarGroup from "./avatar-group";
import Breadcrumbs from "./breadcrumbs";
import Button from "./button";
import ButtonGroup from "./button-group";
import Chip from "./chip";
import Link from "./link";
import Tabs from "./tabs";
import Timeline from "./timeline";
import { cs } from "../i18n/cs";
import Pagination from "./pagination";
import Spinner from "./spinner";
import Stepper from "./stepper";
import Switch from "./switch";
import UIProvider from "../providers/ui-provider";
import * as ui from "../index";

describe("Button", () => {
  it("does nothing and is busy while loading - keeping the focus", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Save</Button>);

    const button = screen.getByRole("button", { name: "Save" });
    act(() => button.focus());
    rerender(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );

    // A native `disabled` would drop the focus to the page in a browser
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveFocus();

    await user.click(button);
    await user.keyboard("{Enter} ");
    expect(onClick).not.toHaveBeenCalled();

    rerender(
      <Button disabled loading onClick={onClick}>
        Save
      </Button>,
    );
    expect(button).toBeDisabled();
  });

  it("does not submit its form while loading", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <input aria-label="Name" />
        <Button loading type="submit">
          Save
        </Button>
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Save" }));
    // Enter in a field clicks the submit button of the form
    await user.type(
      screen.getByRole("textbox", { name: "Name" }),
      "Jana{Enter}",
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("keeps a loading link focusable, but it does not navigate", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button link="/export" loading onClick={onClick}>
        Export
      </Button>,
    );

    const link = screen.getByRole("link", { name: "Export" });
    expect(link).toHaveAttribute("href", "/export");
    expect(link).toHaveAttribute("aria-disabled", "true");
    expect(link).toHaveAttribute("aria-busy", "true");

    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    act(() => {
      link.dispatchEvent(click);
    });
    expect(click.defaultPrevented).toBe(true);
    await user.click(link);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders a link that does not navigate while disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled link="/users/new" onClick={onClick}>
        New user
      </Button>,
    );

    const link = screen.getByRole("link", { name: "New user" });
    expect(link).not.toHaveAttribute("href");
    expect(link).toHaveAttribute("aria-disabled", "true");

    await user.click(link);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("passes ref, data, ARIA and event props on to the link", async () => {
    const user = userEvent.setup();
    const onMouseEnter = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    render(
      <Button
        aria-describedby="hint"
        data-testid="new-user"
        link="/users/new"
        name="ignored"
        onMouseEnter={onMouseEnter}
        ref={ref}
      >
        New user
      </Button>,
    );

    const link = screen.getByRole("link", { name: "New user" });
    expect(ref.current).toBe(link);
    expect(link).toHaveAttribute("data-testid", "new-user");
    expect(link).toHaveAttribute("aria-describedby", "hint");
    // A button-only attribute stays behind
    expect(link).not.toHaveAttribute("name");

    await user.hover(link);
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
  });
});

describe("Switch", () => {
  it("is a checkbox with the switch role", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Switch
        error="Required"
        label="Notifications"
        onChange={(event) => onChange(event.target.checked)}
      />,
    );

    const toggle = screen.getByRole("switch", { name: /Notifications/ });
    expect(toggle).toHaveAccessibleDescription("Required");
    expect(toggle).toHaveAttribute("aria-invalid", "true");

    await user.click(screen.getByText("Notifications"));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(toggle).toBeChecked();
  });
});

describe("Pagination", () => {
  it("pages by numbers from the total", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <Pagination
        currentPage={1}
        onChange={onChange}
        pageSize={20}
        total={45}
      />,
    );

    expect(screen.getByText("1–20 of 45")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Previous page" }),
    ).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Last page" }));
    expect(onChange).toHaveBeenCalledWith("last");

    rerender(
      <Pagination
        currentPage={3}
        onChange={onChange}
        pageSize={20}
        total={45}
      />,
    );
    expect(screen.getByText("41–45 of 45")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("follows the page info of a cursor connection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Pagination
        onChange={onChange}
        pageInfo={{
          endCursor: "c20",
          hasNextPage: true,
          hasPreviousPage: false,
          startCursor: "c1",
        }}
      />,
    );

    // A connection cannot jump to its end
    expect(screen.queryByRole("button", { name: "Last page" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(onChange).toHaveBeenCalledWith("next", "c20");
  });
});

describe("Stepper", () => {
  const steps = [
    { id: 1, title: "Details" },
    { id: 2, title: "Documents" },
    { id: 3, isClickable: false, title: "Review" },
  ];

  it("shows the progress without buttons when read-only", () => {
    render(<Stepper currentStepId={2} steps={steps} />);

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("2. Documents").parentElement).toHaveAttribute(
      "aria-current",
      "step",
    );
  });

  it("reports clicks on the steps that can be clicked", async () => {
    const user = userEvent.setup();
    const onStepClick = vi.fn();
    render(
      <Stepper currentStepId={2} onStepClick={onStepClick} steps={steps} />,
    );

    await user.click(screen.getByRole("button", { name: "1. Details" }));
    expect(onStepClick).toHaveBeenCalledWith(1);
    expect(screen.getByRole("button", { name: "3. Review" })).toBeDisabled();
  });
});

describe("Spinner", () => {
  it("tells screen readers what it shows", () => {
    const { rerender } = render(<Spinner />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");

    rerender(
      <UIProvider locale={cs}>
        <Spinner />
        <Spinner label="Ukládání…" />
      </UIProvider>,
    );
    const [loading, saving] = screen.getAllByRole("status");
    expect(loading).toHaveTextContent("Načítání…");
    expect(saving).toHaveTextContent("Ukládání…");
  });
});

describe("Right-to-left pages", () => {
  it("lay the components out by start and end, not by left and right", () => {
    const { container } = render(
      <>
        <ButtonGroup>
          <Button>One</Button>
          <Button variant="outline">Two</Button>
          <Button>Three</Button>
        </ButtonGroup>
        <Breadcrumbs
          items={[{ href: "/orders", label: "Orders" }, { label: "42" }]}
        />
        <Pagination currentPage={2} onChange={() => {}} total={100} />
        <Stepper
          currentStepId={1}
          onStepClick={() => {}}
          orientation="vertical"
          steps={[
            { content: "Form", id: 1, title: "Details" },
            { id: 2, title: "Review" },
          ]}
        />
        <Timeline
          alternate
          items={[
            { title: "Created" },
            { pending: true, title: "Approved" },
            { title: "Shipped" },
          ]}
        />
        <Tabs
          items={[{ label: "One", value: "1" }]}
          orientation="vertical"
          value="1"
        />
        <Avatar name="Jana" status="online" />
        <AvatarGroup max={2}>
          <Avatar name="A B" />
          <Avatar name="C D" />
          <Avatar name="E F" />
        </AvatarGroup>
        <Chip onRemove={() => {}}>Paid</Chip>
        <Link external href="https://example.com">
          Docs
        </Link>
      </>,
    );

    const physical =
      /^(?:[a-z-]+:)*-?(?:ml|mr|pl|pr|left|right|rounded-[lr]|rounded-[tb][lr]|border-[lr]|text-left|text-right)(?:-|$)/;
    const classes = Array.from(
      container.querySelectorAll("[class]"),
      (element) => (element.getAttribute("class") ?? "").split(/\s+/),
    ).flat();
    expect(classes.filter((name) => physical.test(name))).toEqual([]);
    // Previous points to the start - the right in a right-to-left page
    expect(
      screen
        .getByRole("button", { name: "Previous page" })
        .querySelector("svg"),
    ).toHaveClass("rtl:-scale-x-100");
  });
});

describe("Public helpers", () => {
  it("are exported - the platform, the hydration and the current link", () => {
    expect(ui.toAriaKeyShortcuts("mod+shift+k", true)).toBe("Shift+Meta+K");
    expect(ui.toAriaKeyShortcuts("mod+k", false)).toBe("Control+K");

    const items = [{ href: "/users" }, { href: "/users/new" }];
    expect(ui.findActiveLink(items, (item) => item.href, "/users/new")).toBe(
      items[1],
    );

    let hydrated: boolean | undefined;
    let apple: boolean | undefined;
    function Probe() {
      hydrated = ui.useIsHydrated();
      apple = ui.useIsApplePlatform();
      return null;
    }
    render(<Probe />);
    // Rendered in the browser only - hydrated from the first render
    expect(hydrated).toBe(true);
    expect(typeof apple).toBe("boolean");
  });
});
