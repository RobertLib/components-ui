import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import SystemBanner from "./system-banner";
import { cs } from "../../i18n/ui/cs";
import type { LinkComponentProps } from "../../providers/router";
import UIProvider from "../../providers/ui-provider";

describe("SystemBanner", () => {
  it("is a status with an icon, a title and the message - left out when printed", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <SystemBanner data-testid="banner" ref={ref} title="Signed in as">
        Jana Nováková
      </SystemBanner>,
    );

    const banner = screen.getByRole("status");
    expect(ref.current).toBe(banner);
    expect(screen.getByTestId("banner")).toBe(banner);
    expect(banner).toHaveTextContent("Signed in as Jana Nováková");
    expect(banner).toHaveAttribute("aria-live", "polite");
    expect(banner).toHaveAttribute("data-variant", "info");
    expect(banner).toHaveClass("print:hidden");
    expect(banner.querySelector("strong")).toHaveTextContent("Signed in as");
    // The icon is decoration
    expect(banner.querySelector("[aria-hidden] svg")).not.toBeNull();
  });

  it.each([
    ["danger", "alert", "assertive"],
    ["warning", "alert", "assertive"],
    ["info", "status", "polite"],
    ["neutral", "status", "polite"],
  ] as const)("is %s - an %s", (variant, role, live) => {
    render(<SystemBanner variant={variant}>Message</SystemBanner>);

    const banner = screen.getByRole(role);
    expect(banner).toHaveAttribute("aria-live", live);
    expect(banner).toHaveAttribute("data-variant", variant);
  });

  it("renders nothing without a message", () => {
    const { container } = render(<SystemBanner>{null}</SystemBanner>);
    expect(container).toBeEmptyDOMElement();
  });

  it("takes an icon of its own - or none", () => {
    const { rerender } = render(
      <SystemBanner icon={<svg data-testid="flask" />}>TEST</SystemBanner>,
    );
    expect(screen.getByTestId("flask")).toBeInTheDocument();

    rerender(<SystemBanner icon={false}>TEST</SystemBanner>);
    expect(screen.getByRole("status").querySelector("svg")).toBeNull();
  });

  it("has a link through the router, or a button", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    function RouterLink({ href, ...props }: LinkComponentProps) {
      return <a data-router-link="" href={`/app${href}`} {...props} />;
    }

    const { rerender } = render(
      <UIProvider router={{ Link: RouterLink }}>
        <SystemBanner action={{ href: "/status", label: "Details" }}>
          Planned outage on Saturday
        </SystemBanner>
      </UIProvider>,
    );
    const link = screen.getByRole("link", { name: "Details" });
    expect(link).toHaveAttribute("href", "/app/status");
    expect(link).toHaveAttribute("data-router-link");

    rerender(
      <UIProvider router={{ Link: RouterLink }}>
        <SystemBanner action={{ label: "Stop", onClick }} variant="neutral">
          Signed in as Jana Nováková
        </SystemBanner>
      </UIProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Stop" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("closes - the focus moves on to the next control", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <>
        <SystemBanner dismissible onDismiss={onDismiss}>
          New version installed
        </SystemBanner>
        <button type="button">Next</button>
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Dismiss message" }));
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();
    // Not remembered without a storageKey
    expect(localStorage.length).toBe(0);
  });

  it("stays closed under its storageKey - a message under another one shows", async () => {
    const user = userEvent.setup();
    const first = render(
      <SystemBanner dismissible storageKey="outage-2026-11-01">
        Outage on 1 November
      </SystemBanner>,
    );

    await user.click(screen.getByRole("button", { name: "Dismiss message" }));
    expect(localStorage.getItem("outage-2026-11-01")).toBe("true");
    first.unmount();

    // Another load of the app
    const { rerender } = render(
      <SystemBanner dismissible storageKey="outage-2026-11-01">
        Outage on 1 November
      </SystemBanner>,
    );
    expect(screen.queryByRole("status")).toBeNull();

    rerender(
      <SystemBanner dismissible storageKey="outage-2026-12-06">
        Outage on 6 December
      </SystemBanner>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("6 December");
  });

  it("names its close button in the language of the app", () => {
    render(
      <UIProvider locale={cs}>
        <SystemBanner dismissible variant="warning">
          Testovací prostředí
        </SystemBanner>
      </UIProvider>,
    );

    expect(
      screen.getByRole("button", { name: "Zavřít zprávu" }),
    ).toBeInTheDocument();
  });

  it("renders on the server and hides a closed one once hydrated", async () => {
    localStorage.setItem("test-env", "true");
    const banner = (
      <SystemBanner dismissible storageKey="test-env" variant="warning">
        TEST
      </SystemBanner>
    );
    const html = renderToString(banner);
    expect(html).toContain('role="alert"');

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();
    const root = await act(async () =>
      hydrateRoot(container, banner, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();

    act(() => root.unmount());
    container.remove();
  });
});
