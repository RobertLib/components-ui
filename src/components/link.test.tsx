import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Link from "./link";
import UIProvider from "../providers/ui-provider";
import type { LinkComponentProps } from "../providers/router";
import { cs } from "../i18n/cs";

/** A router link that navigates in memory, marked to be told apart. */
function renderWithRouter(children: React.ReactNode) {
  const navigate = vi.fn();

  function RouterLink({ href, onClick, ...props }: LinkComponentProps) {
    return (
      <a
        {...props}
        data-router-link=""
        href={href}
        onClick={(event) => {
          onClick?.(event);
          event.preventDefault();
          navigate(href);
        }}
      />
    );
  }

  render(<UIProvider router={{ Link: RouterLink }}>{children}</UIProvider>);
  return navigate;
}

describe("Link", () => {
  it("goes through the router for a path", async () => {
    const user = userEvent.setup();
    const navigate = renderWithRouter(
      <p>
        Ordered by <Link href="/customers/42">Jana Nováková</Link>.
      </p>,
    );

    const link = screen.getByRole("link", { name: "Jana Nováková" });
    expect(link).toHaveAttribute("data-router-link");
    expect(link).toHaveClass("underline", "text-primary-600");
    await user.click(link);
    expect(navigate).toHaveBeenCalledWith("/customers/42");
  });

  it("leaves other sites, addresses, anchors and downloads to the browser", () => {
    renderWithRouter(
      <>
        <Link href="https://example.com">Example</Link>
        <Link href="mailto:office@example.com">E-mail</Link>
        <Link href="tel:+420123456789">Phone</Link>
        <Link href="//cdn.example.com/a.pdf">CDN</Link>
        <Link href="#details">Details</Link>
        <Link download href="/reports/2026.pdf">
          Report
        </Link>
      </>,
    );

    for (const link of screen.getAllByRole("link")) {
      expect(link).not.toHaveAttribute("data-router-link");
    }
    expect(screen.getByRole("link", { name: "Report" })).toHaveAttribute(
      "download",
    );
  });

  it("opens an external link in a new tab - and says so", () => {
    renderWithRouter(
      <Link external href="https://example.com/docs" rel="nofollow">
        Documentation
      </Link>,
    );

    const link = screen.getByRole("link", {
      name: "Documentation (opens in a new tab)",
    });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "nofollow noopener noreferrer");
    expect(link).not.toHaveAttribute("data-router-link");
    expect(link.querySelector("svg")?.closest("[aria-hidden]")).not.toBeNull();
  });

  it("says it in the language of the page", () => {
    render(
      <UIProvider locale={cs}>
        <Link external href="https://example.com">
          Dokumentace
        </Link>
      </UIProvider>,
    );

    expect(
      screen.getByRole("link", {
        name: "Dokumentace (otevře se v novém panelu)",
      }),
    ).toBeInTheDocument();
  });

  it("is underlined as asked, in the theme colors", () => {
    render(
      <>
        <Link href="/a" underline="hover">
          Hover
        </Link>
        <Link color="neutral" href="/b" underline="none">
          None
        </Link>
        <Link color="inherit" href="/c">
          Inherit
        </Link>
      </>,
    );

    expect(screen.getByRole("link", { name: "Hover" })).toHaveClass(
      "no-underline",
      "hover:underline",
    );
    const none = screen.getByRole("link", { name: "None" });
    expect(none).toHaveClass("no-underline", "text-neutral-700");
    expect(none).not.toHaveClass("hover:underline");
    expect(screen.getByRole("link", { name: "Inherit" })).toHaveClass(
      "text-inherit",
      "underline",
    );
  });

  it("passes attributes and the ref on", () => {
    const ref = { current: null as HTMLAnchorElement | null };
    render(
      <Link aria-current="page" className="font-bold" href="/orders" ref={ref}>
        Orders
      </Link>,
    );

    const link = screen.getByRole("link", { name: "Orders" });
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link).toHaveClass("font-bold", "link");
    expect(ref.current).toBe(link);
  });
});
