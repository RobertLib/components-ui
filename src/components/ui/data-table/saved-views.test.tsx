import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import DataTable from ".";
import { cs } from "../../../i18n/ui/cs";
import UIProvider from "../../../providers/ui-provider";
import { parseViews } from "./use-saved-views";
import type { Column, DataTableView } from "./types";

interface Row {
  city: string;
  id: number;
  name: string;
  status: string;
}

const rows: Row[] = [
  { city: "Praha", id: 1, name: "Adam", status: "active" },
  { city: "Brno", id: 2, name: "Běla", status: "invited" },
  { city: "Ostrava", id: 3, name: "Cyril", status: "active" },
];

const columns: Column<Row>[] = [
  { filter: "input", key: "name", label: "Name", sortable: true },
  {
    filter: "select",
    filterSelectOptions: [
      { label: "Active", value: "active" },
      { label: "Invited", value: "invited" },
    ],
    key: "status",
    label: "Status",
  },
  { key: "city", label: "City" },
];

const activeOnly: DataTableView = {
  columnState: { visibility: { city: false } },
  id: "active",
  name: "Active people",
  query: {
    filters: { status: "active" },
    pageSize: 10,
    sort: [{ key: "name", order: "desc" }],
  },
};

const viewsButton = (name: string | RegExp = /^Views$|^View: /) =>
  screen.getByRole("button", { name });

const openMenu = async (
  user: ReturnType<typeof userEvent.setup>,
  name?: string | RegExp,
) => {
  await user.click(viewsButton(name));
  return screen.getByRole("menu");
};

const bodyNames = () =>
  within(screen.getAllByRole("rowgroup")[1])
    .getAllByRole("row")
    .map((row) => within(row).getAllByRole("cell")[0].textContent);

const settle = () =>
  act(() => new Promise((resolve) => setTimeout(resolve, 0)));

describe("DataTable saved views", () => {
  it("is not offered unless asked for - and reads nothing stored then", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    render(
      <DataTable clientSide columns={columns} data={rows} tableId="people" />,
    );

    expect(screen.queryByRole("button", { name: "Views" })).toBeNull();
    expect(getItem).not.toHaveBeenCalledWith("table-views-people");
  });

  it("saves the settings as a new view, which becomes the applied one", async () => {
    const user = userEvent.setup();
    const onViewsChange = vi.fn();
    const onActiveViewChange = vi.fn();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{ filters: { status: "active" }, page: 2, pageSize: 5 }}
        enableViews
        onActiveViewChange={onActiveViewChange}
        onViewsChange={onViewsChange}
      />,
    );

    const menu = await openMenu(user);
    await user.click(
      within(menu).getByRole("menuitem", { name: "Save as a new view…" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Save the view" });
    const field = within(dialog).getByRole("textbox", { name: /Name/ });
    expect(field).toHaveFocus();

    // A name is needed
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(within(dialog).getByText("Enter a name.")).toBeInTheDocument();
    expect(onViewsChange).not.toHaveBeenCalled();

    await user.type(field, "  Aktivní  {Enter}");
    await settle();

    expect(onViewsChange).toHaveBeenCalledWith([
      {
        columnState: { order: [], pinning: {}, visibility: {}, widths: {} },
        id: expect.any(String),
        name: "Aktivní",
        // Not the page
        query: {
          filters: { status: "active" },
          pageSize: 5,
          search: "",
          sort: [],
        },
      },
    ]);
    const [[[view]]] = onViewsChange.mock.calls as [[DataTableView[]]];
    expect(onActiveViewChange).toHaveBeenCalledWith(view.id);
    expect(viewsButton("View: Aktivní")).toHaveTextContent("Aktivní");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("applies a view - its filters, sorting, page size and columns, from the first page", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    const onColumnStateChange = vi.fn();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{ filters: { name: "x" }, search: "y" }}
        enableGlobalSearch
        onColumnStateChange={onColumnStateChange}
        onQueryChange={onQueryChange}
        presetViews={[activeOnly]}
      />,
    );

    const menu = await openMenu(user);
    await user.click(
      within(menu).getByRole("menuitemradio", { name: "Active people" }),
    );

    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        filters: { status: "active" },
        order: "desc",
        page: 1,
        pageSize: 10,
        search: "",
        sortBy: "name",
      }),
    );
    expect(onColumnStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ visibility: { city: false } }),
    );
    expect(screen.queryByRole("columnheader", { name: "City" })).toBeNull();
    expect(bodyNames()).toEqual(["Cyril", "Adam"]);
    expect(viewsButton("View: Active people")).toBeInTheDocument();
  });

  it("marks the applied view as modified until it is applied again", async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        presetViews={[activeOnly]}
      />,
    );

    let menu = await openMenu(user);
    await user.click(
      within(menu).getByRole("menuitemradio", { name: "Active people" }),
    );
    expect(screen.queryByRole("menu")).toBeNull();

    await user.click(
      within(screen.getByRole("columnheader", { name: /Name/ })).getByRole(
        "button",
      ),
    );
    expect(viewsButton("View: Active people (modified)")).toBeInTheDocument();

    menu = await openMenu(user, "View: Active people (modified)");
    // A preset cannot be changed
    expect(
      within(menu).queryByRole("menuitem", { name: /Update|Rename|Delete/ }),
    ).toBeNull();
    // No longer checked - the table shows other settings
    await user.click(
      within(menu).getByRole("menuitemradio", {
        checked: false,
        name: "Active people",
      }),
    );

    expect(viewsButton("View: Active people")).toBeInTheDocument();
    expect(bodyNames()).toEqual(["Cyril", "Adam"]);
  });

  it("takes columns back as the view has them for unmodified - also its defaults", async () => {
    const user = userEvent.setup();
    const namesOnly: DataTableView = {
      // A visible column named visible - the table remembers no default
      columnState: { visibility: { city: false, name: true } },
      id: "names",
      name: "Names",
      query: {},
    };
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        presetViews={[namesOnly]}
      />,
    );

    const menu = await openMenu(user);
    await user.click(
      within(menu).getByRole("menuitemradio", { name: "Names" }),
    );
    expect(viewsButton("View: Names")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Columns" }));
    await user.click(screen.getByRole("switch", { name: "Status" }));
    expect(viewsButton("View: Names (modified)")).toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "Status" }));
    expect(viewsButton("View: Names")).toBeInTheDocument();
  });

  it("updates, renames and deletes a view of the user", async () => {
    const user = userEvent.setup();
    const onViewsChange = vi.fn();
    const mine: DataTableView = {
      id: "mine",
      name: "Moje",
      query: { filters: { status: "invited" } },
    };

    function Table() {
      const [views, setViews] = useState([mine]);
      return (
        <DataTable
          clientSide
          columns={columns}
          data={rows}
          onViewsChange={(next) => {
            onViewsChange(next);
            setViews(next);
          }}
          views={views}
        />
      );
    }
    render(<Table />);

    let menu = await openMenu(user);
    await user.click(within(menu).getByRole("menuitemradio", { name: "Moje" }));
    expect(bodyNames()).toEqual(["Běla"]);

    // Nothing to save yet
    menu = await openMenu(user, "View: Moje");
    expect(
      within(menu).getByRole("menuitem", { name: "Update “Moje”" }),
    ).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");

    await user.click(
      within(screen.getByRole("columnheader", { name: /Name/ })).getByRole(
        "button",
      ),
    );
    menu = await openMenu(user, "View: Moje (modified)");
    await user.click(
      within(menu).getByRole("menuitem", { name: "Update “Moje”" }),
    );
    expect(onViewsChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        id: "mine",
        query: expect.objectContaining({
          filters: { status: "invited" },
          sort: [{ key: "name", order: "asc" }],
        }),
      }),
    ]);
    expect(viewsButton("View: Moje")).toBeInTheDocument();

    menu = await openMenu(user, "View: Moje");
    await user.click(within(menu).getByRole("menuitem", { name: "Rename…" }));
    const dialog = screen.getByRole("dialog", { name: "Rename the view" });
    const field = within(dialog).getByRole("textbox", { name: /Name/ });
    expect(field).toHaveValue("Moje");
    await user.clear(field);
    await user.type(field, "Aktivní{Enter}");
    await settle();
    expect(onViewsChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: "mine", name: "Aktivní" }),
    ]);

    menu = await openMenu(user, "View: Aktivní");
    await user.click(
      within(menu).getByRole("menuitem", { name: "Delete view" }),
    );
    const question = screen.getByRole("alertdialog", {
      name: "Delete the view?",
    });
    expect(question).toHaveTextContent("The view “Aktivní” will be deleted.");
    await user.click(
      within(question).getByRole("button", { name: "Delete view" }),
    );
    await settle();

    expect(onViewsChange).toHaveBeenLastCalledWith([]);
    expect(viewsButton("Views")).toBeInTheDocument();
  });

  it("remembers the views under tableId", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        defaultQuery={{ filters: { name: "a" } }}
        enableViews
        tableId="people"
      />,
    );

    const menu = await openMenu(user);
    await user.click(
      within(menu).getByRole("menuitem", { name: "Save as a new view…" }),
    );
    await user.type(
      screen.getByRole("textbox", { name: /Name/ }),
      "S a{Enter}",
    );
    await settle();
    unmount();

    expect(
      JSON.parse(localStorage.getItem("table-views-people") ?? "[]"),
    ).toEqual([expect.objectContaining({ name: "S a" })]);

    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        enableViews
        tableId="people"
      />,
    );
    await user.click(
      within(await openMenu(user)).getByRole("menuitemradio", { name: "S a" }),
    );
    expect(screen.getByRole("searchbox", { name: "Filter Name" })).toHaveValue(
      "a",
    );
  });

  it("follows a controlled activeViewId", async () => {
    const user = userEvent.setup();
    const onActiveViewChange = vi.fn();
    const { rerender } = render(
      <DataTable
        activeViewId="active"
        clientSide
        columns={columns}
        data={rows}
        onActiveViewChange={onActiveViewChange}
        presetViews={[activeOnly]}
      />,
    );
    // Not applied - only named; the table shows other settings
    expect(viewsButton("View: Active people (modified)")).toBeInTheDocument();

    await user.click(
      within(await openMenu(user, "View: Active people (modified)")).getByRole(
        "menuitemradio",
        { name: "Active people" },
      ),
    );
    expect(onActiveViewChange).toHaveBeenCalledWith("active");

    rerender(
      <DataTable
        activeViewId={null}
        clientSide
        columns={columns}
        data={rows}
        onActiveViewChange={onActiveViewChange}
        presetViews={[activeOnly]}
      />,
    );
    expect(viewsButton("Views")).toBeInTheDocument();
  });

  it("speaks Czech", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider locale={cs}>
        <DataTable clientSide columns={columns} data={rows} enableViews />
      </UIProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Pohledy" }));
    expect(
      within(screen.getByRole("menu")).getByRole("menuitem", {
        name: "Uložit jako nový pohled…",
      }),
    ).toBeInTheDocument();
  });
});

describe("parseViews", () => {
  it("keeps the views and values it can use", () => {
    expect(
      parseViews(
        JSON.stringify([
          {
            columnState: {
              visibility: { a: false, b: "no" },
              widths: { a: -1 },
            },
            id: "1",
            name: "One",
            query: {
              filters: { a: "x", b: 5, c: ["", "y"] },
              pageSize: 0,
              search: "s",
              sort: [
                { key: "a", order: "up" },
                { key: "b", order: "desc" },
              ],
            },
          },
          { id: "1", name: "Duplicate" },
          { id: 2, name: "No id" },
          null,
        ]),
      ),
    ).toEqual([
      {
        columnState: {
          order: [],
          pinning: {},
          visibility: { a: false },
          widths: {},
        },
        id: "1",
        name: "One",
        query: {
          filters: { a: "x", c: ["y"] },
          search: "s",
          sort: [{ key: "b", order: "desc" }],
        },
      },
    ]);
  });

  it("refuses a text that is no list", () => {
    expect(() => parseViews("{}")).toThrow();
  });
});
