import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Breadcrumbs from "../components/ui/breadcrumbs";
import Button from "../components/ui/button";
import Calendar from "../components/ui/calendar";
import DataTable from "../components/ui/data-table";
import Header from "../components/ui/header";
import Link from "../components/ui/link";
import useDataTableQuery from "../components/ui/data-table/use-data-table-query";
import Pagination from "../components/ui/pagination";
import Tabs from "../components/ui/tabs";
import { cs } from "../i18n/ui/cs";
import { en } from "../i18n/ui/en";
import type { LinkComponentProps } from "./router";
import {
  useLocale,
  useMessages,
  useNavigate,
  usePortalContainer,
  useRouter,
  useRouterActions,
} from "./ui-context";
import UIProvider from "./ui-provider";

function TestLink({ href, ...props }: LinkComponentProps) {
  return <a data-router-link="" href={`#${href}`} {...props} />;
}

/**
 * Reads all that `UIProvider` gives but the location, telling each render -
 * a `Profiler` misses one a context change causes (React propagates it
 * lazily, past the profiler).
 */
function ContextReader({ onRender }: { onRender: () => void }) {
  useLocale();
  useMessages();
  usePortalContainer();
  useRouterActions();
  onRender();
  return null;
}

describe("UIProvider", () => {
  it("renders links with the router's Link and marks the active tab", () => {
    render(
      <UIProvider
        router={{ Link: TestLink, pathname: "/users/42", search: "" }}
      >
        <Button link="/users">Users</Button>
        <Tabs
          items={[
            { href: "/users", label: "Users" },
            { href: "/users-archive", label: "Archive" },
          ]}
        />
      </UIProvider>,
    );

    const button = screen.getByRole("link", { name: "Users", current: false });
    expect(button).toHaveAttribute("data-router-link");
    expect(button).toHaveAttribute("href", "#/users");
    expect(screen.getByRole("link", { current: "page" })).toHaveTextContent(
      "Users",
    );
  });

  it("goes back and navigates through the adapter", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const back = vi.fn();

    function Pager() {
      const [query, setQuery] = useDataTableQuery({ syncWithUrl: true });
      return (
        <button
          onClick={() => setQuery({ ...query, page: query.page + 1 })}
          type="button"
        >
          page {query.page}
        </button>
      );
    }

    render(
      <UIProvider
        router={{
          back,
          navigate,
          pathname: "/users",
          search: "?tab=all&page=2",
        }}
      >
        <Header back title="Users" />
        <Pager />
      </UIProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(back).toHaveBeenCalledTimes(1);

    // The query is read from the URL and written back through navigate()
    await user.click(screen.getByRole("button", { name: "page 2" }));
    expect(navigate).toHaveBeenCalledWith("/users?tab=all&page=3", {
      replace: false,
    });
  });

  it("renders nothing again for a new navigate or back of an inline adapter", async () => {
    const user = userEvent.setup();
    const rendered = vi.fn();
    const calls: string[] = [];
    // The same elements on every render - only what reads a context renders
    const content = (
      <>
        <ContextReader onRender={rendered} />
        <Header back title="Users" />
        <Button link="/users">Users</Button>
        <Breadcrumbs items={[{ href: "/a", label: "A" }, { label: "B" }]} />
      </>
    );
    // An inline adapter - new functions on every render
    const renderWith = (label: string) => (
      <UIProvider
        router={{
          back: () => calls.push(`back ${label}`),
          navigate: (href) => calls.push(`${href} ${label}`),
          pathname: "/users",
          search: "",
        }}
      >
        {content}
      </UIProvider>
    );
    const { rerender } = render(renderWith("first"));
    rendered.mockClear();

    rerender(renderWith("second"));
    expect(rendered).not.toHaveBeenCalled();

    // The latest ones are called
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(calls).toEqual(["back second"]);
  });

  it("renders again on a navigation only what reads the location", () => {
    const rendered = vi.fn();
    const linkRendered = vi.fn();
    const seen: string[] = [];
    function CountingLink(props: LinkComponentProps) {
      linkRendered();
      return <TestLink {...props} />;
    }
    function Location() {
      const { pathname, search } = useRouter();
      seen.push(pathname + search);
      return null;
    }
    // The same elements on every render - only what reads a context renders
    const content = (
      <>
        <ContextReader onRender={rendered} />
        {/* Its link back counts its renders - without the React Compiler,
            which keeps the link of a Header rendering again */}
        <Header backHref="/users" title="User" />
        <Button link="/users">Users</Button>
        <Link href="/orders">Orders</Link>
        <Breadcrumbs items={[{ href: "/a", label: "A" }, { label: "B" }]} />
        {/* Below a nested provider, which takes the location over */}
        <UIProvider locale={cs}>
          <ContextReader onRender={rendered} />
          <Location />
        </UIProvider>
      </>
    );
    // React Router's adapter - a new location on every navigation; inline
    // `messages` and `portalContainer`, new on every render
    const renderAt = (pathname: string, search: string) => (
      <UIProvider
        messages={{ ui: { breadcrumbs: { home: "Start" } } }}
        portalContainer={() => document.body}
        router={{ Link: CountingLink, navigate() {}, pathname, search }}
      >
        {content}
      </UIProvider>
    );
    const { rerender } = render(renderAt("/users", ""));
    rendered.mockClear();
    linkRendered.mockClear();

    rerender(renderAt("/orders", "?page=2"));
    expect(rendered).not.toHaveBeenCalled();
    expect(linkRendered).not.toHaveBeenCalled();
    expect(seen.at(-1)).toBe("/orders?page=2");
  });

  it("lets a nested provider take over the latest navigate", () => {
    const calls: string[] = [];
    let navigateWith: ((href: string) => void) | undefined;
    function Navigator() {
      const navigate = useNavigate();
      useEffect(() => {
        navigateWith = navigate;
      });
      return null;
    }
    const renderWith = (label: string) => (
      <UIProvider
        router={{
          navigate: (href) => calls.push(`${href} ${label}`),
          pathname: "/",
          search: "",
        }}
      >
        <UIProvider locale={cs}>
          <Navigator />
        </UIProvider>
      </UIProvider>
    );
    const { rerender } = render(renderWith("first"));
    const first = navigateWith;
    rerender(renderWith("second"));

    expect(navigateWith).toBe(first);
    act(() => navigateWith?.("/orders"));
    expect(calls).toEqual(["/orders second"]);
  });

  it("uses the locale and message overrides", () => {
    render(
      <UIProvider
        locale={cs}
        messages={{ ui: { breadcrumbs: { home: "Úvod" } } }}
      >
        <Breadcrumbs items={[{ label: "Faktury" }]} />
        <Pagination
          currentPage={2}
          onChange={() => {}}
          pageSize={20}
          total={45}
        />
      </UIProvider>,
    );

    expect(screen.getByRole("link", { name: "Úvod" })).toBeInTheDocument();
    expect(screen.getByText("21–40 z 45")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Další stránka" }),
    ).toBeInTheDocument();
  });

  it("shows changed message overrides", () => {
    const renderWith = (home: string) => (
      <UIProvider messages={{ ui: { breadcrumbs: { home } } }}>
        <Breadcrumbs items={[{ label: "Invoices" }]} />
      </UIProvider>
    );
    const { rerender } = render(renderWith("Start"));
    expect(screen.getByRole("link", { name: "Start" })).toBeInTheDocument();

    rerender(renderWith("Dashboard"));
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("lets a nested provider change the language but keep the router", () => {
    render(
      <UIProvider router={{ Link: TestLink }}>
        <UIProvider locale={cs}>
          <Breadcrumbs items={[{ href: "/a", label: "A" }, { label: "B" }]} />
        </UIProvider>
      </UIProvider>,
    );

    const home = screen.getByRole("link", { name: "Domů" });
    expect(home).toHaveAttribute("data-router-link");
  });

  it("falls back from a locale code Intl does not understand", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const locale = { ...en, code: "en_GB" };

    render(
      <UIProvider locale={locale}>
        <Calendar initialDate={new Date(2026, 8, 24)} initialView="week" />
        <DataTable
          clientSide
          columns={[{ key: "name", label: "Name", sortable: true }]}
          data={[
            { id: 1, name: "Zoe" },
            { id: 2, name: "Adam" },
          ]}
          defaultQuery={{ order: "asc", sortBy: "name" }}
        />
      </UIProvider>,
    );

    // Rendered instead of throwing "Invalid language tag"
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getAllByRole("row").at(-1)).toHaveTextContent("Zoe");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"en_GB"'));
  });
});
