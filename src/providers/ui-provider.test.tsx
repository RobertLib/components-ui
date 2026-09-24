import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Breadcrumbs from "../components/breadcrumbs";
import Button from "../components/button";
import Calendar from "../components/calendar";
import DataTable from "../components/data-table";
import Header from "../components/header";
import useDataTableQuery from "../components/data-table/use-data-table-query";
import Pagination from "../components/pagination";
import Tabs from "../components/tabs";
import { cs } from "../i18n/cs";
import { en } from "../i18n/en";
import type { LinkComponentProps } from "./router";
import UIProvider from "./ui-provider";

function TestLink({ href, ...props }: LinkComponentProps) {
  return <a data-router-link="" href={`#${href}`} {...props} />;
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

  it("uses the locale and message overrides", () => {
    render(
      <UIProvider locale={cs} messages={{ breadcrumbs: { home: "Úvod" } }}>
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
