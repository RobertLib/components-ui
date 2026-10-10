import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DataTable from ".";

const row = { id: 1, joined: new Date(2026, 8, 24), name: "Adam" };
const columns = [
  { key: "joined", label: "Joined", editable: true },
  { key: "name", label: "Name", editable: true },
];

describe("DataTable date editing validation", () => {
  it.each(["{Enter}", "{Tab}", "{Shift>}{Tab}{/Shift}"])(
    "keeps an invalid date editable on %s, then saves a corrected value",
    async (key) => {
      const user = userEvent.setup();
      const onCellEdit = vi.fn();
      render(
        <DataTable columns={columns} data={[row]} onCellEdit={onCellEdit} />,
      );

      await user.dblClick(screen.getAllByRole("cell")[0]);
      const input = screen.getByRole("combobox", { name: "Joined" });
      await user.keyboard(`{Control>}a{/Control}02/31/2026${key}`);

      expect(onCellEdit).not.toHaveBeenCalled();
      expect(input).toHaveValue("02/31/2026");
      expect(input).toHaveFocus();
      expect(input).toHaveAttribute("aria-invalid", "true");
      const error = screen.getByRole("alert");
      expect(error).toHaveTextContent("02/31/2026");
      expect(input).toHaveAttribute("aria-describedby", error.id);

      await user.keyboard(`{Control>}a{/Control}09/30/2026${key}`);

      expect(onCellEdit).toHaveBeenCalledExactlyOnceWith(
        row,
        "joined",
        new Date(2026, 8, 30),
      );
      expect(screen.queryByRole("combobox", { name: "Joined" })).toBeNull();
      expect(screen.queryByRole("alert")).toBeNull();
      if (key === "{Tab}") {
        expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus();
      } else {
        expect(screen.getAllByRole("cell")[0]).toHaveFocus();
      }
    },
  );

  it.each(["Enter", "Tab", "blur"])(
    "does not save an earlier draft when invalid text is confirmed by %s",
    async (confirmation) => {
      const user = userEvent.setup();
      const onCellEdit = vi.fn();
      render(
        <>
          <DataTable columns={columns} data={[row]} onCellEdit={onCellEdit} />
          <button type="button">Outside</button>
        </>,
      );

      await user.dblClick(screen.getAllByRole("cell")[0]);
      const input = screen.getByRole("combobox", { name: "Joined" });
      await user.click(input);
      await user.keyboard("{Control>}a{/Control}09/25/2026{Enter}");
      expect(onCellEdit).not.toHaveBeenCalled();
      expect(input).toHaveValue("09/25/2026");
      await user.keyboard("{Control>}a{/Control}02/31/2026");
      if (confirmation === "blur") {
        await user.click(screen.getByRole("button", { name: "Outside" }));
      } else {
        await user.keyboard(`{${confirmation}}`);
      }

      expect(onCellEdit).not.toHaveBeenCalled();
      expect(input).toHaveValue("02/31/2026");
      expect(input).toHaveFocus();
      expect(screen.getByRole("alert")).toHaveTextContent("02/31/2026");

      await user.keyboard("{Control>}a{/Control}09/26/2026");
      const outside = screen.getByRole("button", { name: "Outside" });
      await user.click(outside);

      await waitFor(() =>
        expect(onCellEdit).toHaveBeenCalledExactlyOnceWith(
          row,
          "joined",
          new Date(2026, 8, 26),
        ),
      );
      expect(outside).toHaveFocus();
      expect(screen.queryByRole("combobox", { name: "Joined" })).toBeNull();
    },
  );

  it("lets a popup correct invalid text without stealing its focus", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(
      <DataTable columns={columns} data={[row]} onCellEdit={onCellEdit} />,
    );

    await user.dblClick(screen.getAllByRole("cell")[0]);
    const input = screen.getByRole("combobox", { name: "Joined" });
    await user.keyboard("{Control>}a{/Control}02/31/2026{Enter}");
    await user.click(input);
    const month = screen.getByRole("combobox", { name: "Month" });
    await user.selectOptions(month, "9");
    expect(month).toHaveFocus();
    expect(onCellEdit).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "October 1, 2026" }));
    expect(input).toHaveValue("10/01/2026");
    expect(screen.queryByRole("alert")).toBeNull();

    await user.keyboard("{Enter}");
    expect(onCellEdit).toHaveBeenCalledExactlyOnceWith(
      row,
      "joined",
      new Date(2026, 9, 1),
    );
  });

  it.each(["open Enter", "closed ArrowDown"])(
    "preserves invalid text and an earlier draft on %s",
    async (confirmation) => {
      const user = userEvent.setup();
      const onCellEdit = vi.fn();
      render(
        <DataTable columns={columns} data={[row]} onCellEdit={onCellEdit} />,
      );

      await user.dblClick(screen.getAllByRole("cell")[0]);
      const input = screen.getByRole("combobox", { name: "Joined" });
      await user.click(input);
      await user.keyboard("{Control>}a{/Control}09/25/2026{Enter}");
      expect(onCellEdit).not.toHaveBeenCalled();
      expect(input).toHaveValue("09/25/2026");
      if (confirmation === "open Enter") await user.click(input);
      await user.keyboard(
        `{Control>}a{/Control}02/31/2026{${confirmation === "open Enter" ? "Enter" : "ArrowDown"}}`,
      );

      expect(onCellEdit).not.toHaveBeenCalled();
      expect(input).toHaveValue("02/31/2026");
      expect(screen.getByRole("alert")).toHaveTextContent("02/31/2026");
      expect(input).toHaveAttribute("aria-expanded", "true");
      if (confirmation === "closed ArrowDown") {
        // A keyboard opening intentionally moves into the calendar after
        // its first frame. Return to the text field before checking Tab.
        await waitFor(() =>
          expect(
            screen.getByRole("button", { name: "September 25, 2026" }),
          ).toHaveFocus(),
        );
        await user.click(input);
      }
      expect(input).toHaveFocus();
      await user.keyboard("{Tab}");
      expect(onCellEdit).not.toHaveBeenCalled();
      expect(input).toHaveValue("02/31/2026");
      expect(input).toHaveFocus();

      if (confirmation === "closed ArrowDown") {
        await user.keyboard("{ArrowDown}");
        const day = screen.getByRole("button", { name: "September 26, 2026" });
        expect(input).not.toHaveFocus();
        await user.click(day);
        expect(input).toHaveValue("09/26/2026");
      } else {
        await user.keyboard("{Escape}");
      }
      await user.keyboard("{Control>}a{/Control}09/26/2026{Enter}");
      expect(onCellEdit).toHaveBeenCalledExactlyOnceWith(
        row,
        "joined",
        new Date(2026, 8, 26),
      );
    },
  );

  it("cancels invalid text with Escape after closing an open popup", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    render(
      <DataTable columns={columns} data={[row]} onCellEdit={onCellEdit} />,
    );

    await user.dblClick(screen.getAllByRole("cell")[0]);
    const input = screen.getByRole("combobox", { name: "Joined" });
    await user.keyboard("{Control>}a{/Control}02/31/2026{Enter}");
    await user.click(input);
    await user.keyboard("{Escape}");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveValue("02/31/2026");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("combobox", { name: "Joined" })).toBeNull();
    expect(screen.getAllByRole("cell")[0]).toHaveFocus();
    expect(onCellEdit).not.toHaveBeenCalled();
  });

  it("does not save an invalid draft when its blurred popup is unmounted", async () => {
    const user = userEvent.setup();
    const onCellEdit = vi.fn();
    const { unmount } = render(
      <DataTable columns={columns} data={[row]} onCellEdit={onCellEdit} />,
    );

    await user.dblClick(screen.getAllByRole("cell")[0]);
    const input = screen.getByRole("combobox", { name: "Joined" });
    await user.click(input);
    await user.keyboard("{Control>}a{/Control}09/25/2026{Enter}");
    await user.keyboard("{Control>}a{/Control}02/31/2026{Enter}");
    await user.click(input);
    const month = screen.getByRole("combobox", { name: "Month" });
    await user.selectOptions(month, "9");

    // A containing dialog or navigation can remove the editor before the
    // deferred blur save gets a chance to run.
    act(() => {
      fireEvent.blur(month, { relatedTarget: document.body });
      unmount();
    });

    expect(onCellEdit).not.toHaveBeenCalled();
  });
});
