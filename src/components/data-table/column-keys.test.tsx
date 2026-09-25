import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DataTable from ".";
import type { Column } from "./types";

// Keys as a backend may name its fields - quotes and backslashes included
const QUOTED = 'address["city"]';
const ESCAPED = "path\\to";

type Row = Record<string, string | number> & { id: number };

const rows: Row[] = [
  { [ESCAPED]: "C:", [QUOTED]: "Brno", id: 1, name: "Adam" },
  { [ESCAPED]: "D:", [QUOTED]: "Praha", id: 2, name: "Běla" },
];

const columns: Column<Row>[] = [
  { key: "name", label: "Name" },
  { key: QUOTED, label: "City" },
  { key: ESCAPED, label: "Path" },
];

const headers = () =>
  within(screen.getAllByRole("rowgroup")[0])
    .getAllByRole("columnheader")
    .map((header) => header.textContent);

describe("DataTable column keys", () => {
  it("moves columns with quotes and backslashes in their keys from the keyboard", async () => {
    const user = userEvent.setup();
    // A selector made of the key threw in the next animation frame
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    render(<DataTable columns={columns} data={rows} />);

    await user.click(screen.getByRole("button", { name: "Columns" }));
    const city = screen.getByRole("button", { name: "Move City (arrow keys)" });
    city.focus();
    await user.keyboard("{ArrowDown}");
    expect(headers()).toEqual(["Name", "Path", "City"]);
    // The row moved and lost the focus - its handle gets it back
    screen.getByRole("button", { name: "Reset columns" }).focus();
    expect(() => frames.forEach((frame) => frame(0))).not.toThrow();
    await waitFor(() => expect(city).toHaveFocus());

    const path = screen.getByRole("button", { name: "Move Path (arrow keys)" });
    path.focus();
    await user.keyboard("{ArrowUp}");
    expect(headers()).toEqual(["Path", "Name", "City"]);
    screen.getByRole("button", { name: "Reset columns" }).focus();
    expect(() => frames.forEach((frame) => frame(0))).not.toThrow();
    expect(path).toHaveFocus();
  });
});
