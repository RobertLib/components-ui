import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DataTable from ".";
import type { Column } from "./types";

interface Row {
  id: number;
  name: string;
}

const rows: Row[] = Array.from({ length: 15 }, (_, index) => ({
  id: index + 1,
  name: `Name ${index + 1}`,
}));

const columns: Column<Row>[] = [
  { filter: "input", key: "name", label: "Name" },
];

const bodyRowCount = () =>
  within(screen.getAllByRole("rowgroup")[1]).getAllByRole("row").length;

describe("DataTable filter fields", () => {
  it("drops a filter still being typed when the filters are cleared", () => {
    vi.useFakeTimers();
    try {
      const onQueryChange = vi.fn();
      render(
        <DataTable
          clientSide
          columns={columns}
          data={rows}
          defaultQuery={{ pageSize: 20 }}
          onQueryChange={onQueryChange}
        />,
      );
      const field = screen.getByRole("searchbox", { name: "Filter Name" });

      fireEvent.change(field, { target: { value: "Name 1" } });
      act(() => vi.advanceTimersByTime(400));
      expect(onQueryChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ filters: { name: "Name 1" } }),
      );

      // Typing on, and "Clear filters" before the typing pauses
      fireEvent.change(field, { target: { value: "Name 12" } });
      fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
      expect(field).toHaveValue("");
      expect(onQueryChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ filters: {} }),
      );

      // The text typed before does not come back once the delay is over
      act(() => vi.advanceTimersByTime(400));
      expect(onQueryChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ filters: {} }),
      );
      expect(field).toHaveValue("");
      expect(bodyRowCount()).toBe(15);
    } finally {
      vi.useRealTimers();
    }
  });

  it("leaves an Escape ending an IME composition to the input method", () => {
    render(<DataTable clientSide columns={columns} data={rows} />);
    const field = screen.getByRole("searchbox", { name: "Filter Name" });
    fireEvent.change(field, { target: { value: "にほ" } });

    fireEvent.keyDown(field, { isComposing: true, key: "Escape" });
    // Safari sends the key ending the composition after it
    fireEvent.keyDown(field, { key: "Escape", keyCode: 229 });
    expect(field).toHaveValue("にほ");

    fireEvent.keyDown(field, { key: "Escape" });
    expect(field).toHaveValue("");
  });

  it("drops a filter typed from scratch when the filters are cleared", () => {
    vi.useFakeTimers();
    try {
      const onQueryChange = vi.fn();
      // Server data - a filter of no column is one to clear too
      render(
        <DataTable
          columns={columns}
          data={rows}
          defaultQuery={{ filters: { other: "x" }, pageSize: 20 }}
          onQueryChange={onQueryChange}
          total={rows.length}
        />,
      );
      const field = screen.getByRole("searchbox", { name: "Filter Name" });

      // The query of the field is still "" - nothing it could follow
      fireEvent.change(field, { target: { value: "Name 3" } });
      fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
      act(() => vi.advanceTimersByTime(400));

      expect(field).toHaveValue("");
      expect(onQueryChange).toHaveBeenCalledTimes(1);
      expect(onQueryChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ filters: {} }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("empties a filter field on Escape without leaving the full screen", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(
      <DataTable
        clientSide
        columns={columns}
        data={rows}
        onQueryChange={onQueryChange}
      />,
    );
    const toggle = screen.getByRole("button", { name: "Toggle full screen" });
    await user.click(toggle);

    const field = screen.getByRole("searchbox", { name: "Filter Name" });
    await user.type(field, "Name 1");
    await user.keyboard("{Escape}");

    expect(field).toHaveValue("");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    // Committed at once - no filter left for the delay to apply
    expect(onQueryChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ filters: { name: "Name 1" } }),
    );

    // An empty field leaves Escape to the full screen
    await user.keyboard("{Escape}");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });
});
