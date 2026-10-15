import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import DataTable from ".";
import { cs } from "../../../i18n/ui/cs";
import UIProvider from "../../../providers/ui-provider";
import type { Column } from "./types";

interface Row {
  id: number;
  name: string;
  salary: number;
}

const rows: Row[] = [
  { id: 1, name: "Adam", salary: 100 },
  { id: 2, name: "Běla", salary: 200 },
];

const columns: Column<Row>[] = [
  { filter: "input", key: "name", label: "Name", sortable: true },
  { key: "salary", label: "Salary", summary: "sum" },
];

const body = () => screen.getAllByRole("rowgroup")[1];

describe("DataTable load error", () => {
  it("shows a generic message in place of the rows for error={true}, as an alert", () => {
    render(<DataTable columns={columns} data={rows} error total={2} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The data could not be loaded.",
    );
    // The rows of the query that failed (or an older one) are gone
    expect(within(body()).queryByText("Adam")).toBeNull();
    expect(within(body()).getAllByRole("row")).toHaveLength(1);
    // So is the summary of rows no longer shown
    expect(screen.queryByText("Sum")).toBeNull();
  });

  it("shows its own message and says it in Czech", () => {
    const { rerender } = render(
      <DataTable columns={columns} data={[]} error="Server is down" />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Server is down");

    rerender(
      <UIProvider locale={cs}>
        <DataTable columns={columns} data={[]} error onRetry={() => {}} />
      </UIProvider>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Data se nepodařilo načíst.",
    );
    expect(
      screen.getByRole("button", { name: "Zkusit znovu" }),
    ).toBeInTheDocument();
  });

  it("ignores an empty error", () => {
    render(
      <DataTable
        columns={columns}
        data={rows}
        error={false}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Adam")).toBeInTheDocument();
  });

  it("calls onRetry from its button - without onRetry there is none", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { rerender } = render(
      <DataTable columns={columns} data={[]} error onRetry={onRetry} />,
    );

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(<DataTable columns={columns} data={[]} error />);
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("wins over loading - the button shows a spinner and keeps the focus meanwhile", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { rerender } = render(
      <DataTable columns={columns} data={[]} error onRetry={onRetry} />,
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));

    rerender(
      <DataTable columns={columns} data={[]} error loading onRetry={onRetry} />,
    );

    const button = screen.getByRole("button", { name: /Try again/ });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveFocus();
    // No placeholder rows under the message
    expect(within(body()).getAllByRole("row")).toHaveLength(1);
    await user.click(button);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("announces a retry failing again with the same message", () => {
    const { rerender } = render(
      <DataTable columns={columns} data={[]} error onRetry={() => {}} />,
    );
    const first = screen.getByRole("alert");

    rerender(
      <DataTable
        columns={columns}
        data={[]}
        error
        loading
        onRetry={() => {}}
      />,
    );
    // Still the alert of the failure
    expect(screen.getByRole("alert")).toBe(first);

    rerender(
      <DataTable columns={columns} data={[]} error onRetry={() => {}} />,
    );
    // A new alert - screen readers hear it again
    expect(screen.getByRole("alert")).not.toBe(first);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The data could not be loaded.",
    );
  });

  it("keeps the toolbar, the filters and the pagination usable", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={[]}
        defaultQuery={{ pageSize: 5 }}
        enableGlobalSearch
        error
        onQueryChange={onQueryChange}
        total={20}
      />,
    );

    await user.type(
      screen.getByRole("searchbox", { name: "Filter Name" }),
      "a",
    );
    await act(() => new Promise((resolve) => setTimeout(resolve, 350)));
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ filters: { name: "a" } }),
    );

    await user.click(
      within(screen.getByRole("columnheader", { name: "Name" })).getByRole(
        "button",
      ),
    );
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBy: "name" }),
    );

    await user.click(screen.getByRole("button", { name: /Next/ }));
    expect(onQueryChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    );
  });

  it("does not let the user select the rows it hides", () => {
    render(
      <DataTable
        columns={columns}
        data={rows}
        error
        groupActions={[{ label: "Delete", onClick: () => {} }]}
      />,
    );

    expect(
      screen.getByRole("checkbox", { name: "Select all rows" }),
    ).toBeDisabled();
  });

  it("gives the focus of its button to the rows once they load", async () => {
    const user = userEvent.setup();

    function Table() {
      const [failed, setFailed] = useState(true);
      return (
        <DataTable
          columns={columns}
          data={failed ? [] : rows}
          error={failed}
          groupActions={[{ label: "Delete", onClick: () => {} }]}
          onRetry={() => setFailed(false)}
        />
      );
    }
    render(<Table />);

    await user.click(screen.getByRole("button", { name: "Try again" }));
    await act(() => Promise.resolve());

    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.getAllByRole("checkbox", { name: /Select row/ })[0],
    ).toHaveFocus();
  });
});
