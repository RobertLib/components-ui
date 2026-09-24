import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import DataTable from ".";
import { cs } from "../../i18n/cs";
import UIProvider from "../../providers/ui-provider";
import type { Column } from "./types";

interface Row {
  id: number;
  name: string;
}

const rows: Row[] = [
  { id: 1, name: "Adam" },
  { id: 2, name: "Běla" },
];

const columns: Column<Row>[] = [{ key: "name", label: "Name" }];

const firstCell = () =>
  within(screen.getAllByRole("row")[1]).getAllByRole("cell")[0];

describe("DataTable row density", () => {
  it("keeps the normal rows by default", () => {
    render(<DataTable columns={columns} data={rows} />);

    expect(firstCell()).toHaveClass("py-1", "text-sm");
  });

  it("takes the density of the table", () => {
    render(<DataTable columns={columns} data={rows} density="compact" />);

    expect(firstCell()).toHaveClass("py-0.5", "text-xs");
  });

  it("lets the user switch the density and remembers it", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} data={rows} tableId="people" />);

    const toggle = screen.getByRole("button", { name: "Row density" });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    const group = screen.getByRole("group", { name: "Row density" });
    expect(
      within(group).getByRole("button", { name: "Normal" }),
    ).toHaveAttribute("aria-pressed", "true");

    await user.click(
      within(group).getByRole("button", { name: "Comfortable" }),
    );

    // A pick closes the panel
    expect(screen.queryByRole("group", { name: "Row density" })).toBeNull();
    expect(firstCell()).toHaveClass("py-2.5");
    expect(
      JSON.parse(localStorage.getItem("table-state-people") ?? "{}"),
    ).toMatchObject({ density: "comfortable" });

    // Back at the table's own - nothing to remember
    await user.click(toggle);
    await user.click(screen.getByRole("button", { name: "Normal" }));
    expect(firstCell()).toHaveClass("py-1");
    expect(localStorage.getItem("table-state-people")).toBeNull();
  });

  it("is operated from the keyboard", async () => {
    const user = userEvent.setup();
    render(
      <>
        <DataTable columns={columns} data={rows} />
        <button type="button">After the table</button>
      </>,
    );

    const toggle = screen.getByRole("button", { name: "Row density" });
    toggle.focus();
    await user.keyboard("{Enter}");
    await user.tab();
    expect(screen.getByRole("button", { name: "Compact" })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(firstCell()).toHaveClass("py-0.5");
    // The panel closed with the focus in it - back to its trigger
    await waitFor(() => expect(toggle).toHaveFocus());

    await user.keyboard("{Enter}");
    await user.tab();
    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "Comfortable" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("group", { name: "Row density" })).toBeNull();
    expect(toggle).toHaveFocus();
  });

  it("leaves the control out on request, and with it a saved density", () => {
    localStorage.setItem(
      "table-state-people",
      JSON.stringify({ density: "comfortable" }),
    );
    render(
      <DataTable
        columns={columns}
        data={rows}
        densityControl={false}
        tableId="people"
      />,
    );

    expect(screen.queryByRole("button", { name: "Row density" })).toBeNull();
    expect(firstCell()).toHaveClass("py-1");
  });

  it("names the densities in the language of the table", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider locale={cs}>
        <DataTable columns={columns} data={rows} />
      </UIProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Hustota řádků" }));

    expect(
      within(screen.getByRole("group", { name: "Hustota řádků" }))
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Kompaktní", "Normální", "Vzdušná"]);
  });
});
