import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { Profiler } from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DataTable from ".";
import UIProvider from "../../../providers/ui-provider";
import type { Column } from "./types";
import {
  browserNavigate,
  type LinkComponentProps,
} from "../../../providers/router";

interface Row {
  id: number;
  name: string;
  note: string;
}

const rows: Row[] = [
  { id: 1, name: "Adam", note: "First" },
  { id: 2, name: "Běla", note: "Second" },
  { id: 3, name: "Cyril", note: "Third" },
];

const columns: Column<Row>[] = [
  { key: "name", label: "Name" },
  { key: "note", label: "Note" },
];

const bodyRows = () =>
  within(screen.getAllByRole("rowgroup")[1]).getAllByRole("row");

describe("DataTable row activation", () => {
  it("calls onRowClick for a click on the row, not on its controls", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <DataTable
        actions={(row) => (
          <button onClick={() => {}} type="button">
            Edit {row.name}
          </button>
        )}
        columns={[
          ...columns,
          {
            editable: true,
            key: "email",
            label: "Email",
            render: () => "a@b.cz",
          },
          {
            key: "link",
            label: "Link",
            render: (row) => <a href={`#${row.id}`}>Open</a>,
          },
        ]}
        data={rows}
        groupActions={[{ label: "Archive", onClick: () => {} }]}
        onCellEdit={() => {}}
        onRowClick={onRowClick}
      />,
    );

    await user.click(screen.getByText("Second"));
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(
      rows[1],
      expect.objectContaining({ type: "click" }),
    );
    expect(bodyRows()[1]).toHaveClass("cursor-pointer");

    // Controls of the row are theirs
    await user.click(screen.getByRole("button", { name: "Edit Adam" }));
    await user.click(
      within(bodyRows()[0]).getByRole("checkbox", { name: /Select row/ }),
    );
    await user.click(within(bodyRows()[0]).getAllByText("a@b.cz")[0]);
    await user.click(within(bodyRows()[0]).getByRole("link", { name: "Open" }));
    // The cell around the checkbox too
    await user.click(
      within(bodyRows()[0]).getByRole("checkbox").closest("td")!,
    );
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it("takes no click whose press began on a control of the row", () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        actions={(row) => <button type="button">Edit {row.name}</button>}
        columns={columns}
        data={rows}
        onRowClick={onRowClick}
      />,
    );

    // Pressed on the button, released on another cell - the browser clicks
    // what holds both, the row
    fireEvent.mouseDown(screen.getByRole("button", { name: "Edit Adam" }));
    fireEvent.click(bodyRows()[0], { detail: 1 });
    expect(onRowClick).not.toHaveBeenCalled();

    fireEvent.mouseDown(screen.getByText("First"));
    fireEvent.click(bodyRows()[0], { detail: 1 });
    expect(onRowClick).toHaveBeenCalledOnce();
    // Shift + press selects no text up to the row
    expect(
      fireEvent.mouseDown(screen.getByText("First"), { shiftKey: true }),
    ).toBe(false);
  });

  it("does not take the end of selecting text for a click", () => {
    const onRowClick = vi.fn();
    render(<DataTable columns={columns} data={rows} onRowClick={onRowClick} />);

    const cell = screen.getByText("Second");
    const selection = window.getSelection()!;
    selection.selectAllChildren(cell);
    fireEvent.click(cell);
    expect(onRowClick).not.toHaveBeenCalled();

    selection.removeAllRanges();
    fireEvent.click(cell);
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it("makes the rows one tab stop, with Enter and the arrow keys", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    render(
      <>
        <DataTable
          columns={columns}
          data={rows}
          onRowClick={onRowClick}
          pagination={false}
        />
        <button type="button">After</button>
      </>,
    );

    const [first, second, third] = bodyRows();
    expect(first).toHaveAttribute("tabindex", "0");
    expect(second).toHaveAttribute("tabindex", "-1");

    first.focus();
    await user.keyboard("{ArrowDown}");
    expect(second).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onRowClick).toHaveBeenCalledWith(
      rows[1],
      expect.objectContaining({ key: "Enter" }),
    );

    await user.keyboard("{End}");
    expect(third).toHaveFocus();
    await user.keyboard("{Home}");
    expect(first).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(first).toHaveFocus();

    // The row focused last is the tab stop
    await user.keyboard("{ArrowDown}{ArrowDown}");
    screen.getByRole("button", { name: "After" }).focus();
    expect(first).toHaveAttribute("tabindex", "-1");
    await user.tab({ shift: true });
    expect(third).toHaveFocus();
  });

  it("makes rows without conditional links reachable from the keyboard", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const data = [...rows, { id: 4, name: "Dana", note: "Fourth" }];
    const props = {
      columns,
      data,
      getRowHref: (row: Row) => (row.id === 2 ? "/people/2" : undefined),
      onRowClick,
    };
    const { rerender } = render(<DataTable {...props} />);

    const [first, linked, third, fourth] = bodyRows();
    expect(linked).not.toHaveAttribute("tabindex");
    expect(first).toHaveAttribute("tabindex", "0");
    expect(third).toHaveAttribute("tabindex", "-1");
    first.focus();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(third).toHaveFocus();
    expect(onRowClick).toHaveBeenCalledWith(
      data[2],
      expect.objectContaining({ type: "keydown" }),
    );
    await user.keyboard("{End}");
    expect(fourth).toHaveFocus();
    await user.keyboard("{Home}");
    expect(first).toHaveFocus();
    await user.keyboard("{ArrowDown}{ArrowUp}");
    expect(first).toHaveFocus();

    // A row acquiring a link gives the row tab stop to another unlinked row.
    rerender(
      <DataTable
        {...props}
        getRowHref={(row) => (row.id < 3 ? `/people/${row.id}` : undefined)}
      />,
    );
    expect(first).not.toHaveAttribute("tabindex");
    expect(third).toHaveAttribute("tabindex", "0");
  });

  it("links the first cell of a row with getRowHref", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const onRowClick = vi.fn();
    function Link({ href, onClick, ...props }: LinkComponentProps) {
      return (
        <a
          {...props}
          href={href}
          onClick={(event) => {
            onClick?.(event);
            if (event.defaultPrevented) return;
            event.preventDefault();
            navigate(href, { ctrlKey: event.ctrlKey });
          }}
        />
      );
    }

    render(
      <UIProvider router={{ Link }}>
        <DataTable
          columns={columns}
          data={rows}
          getRowHref={(row) => (row.id === 3 ? undefined : `/people/${row.id}`)}
          onRowClick={onRowClick}
        />
      </UIProvider>,
    );

    const link = screen.getByRole("link", { name: "Adam" });
    expect(link).toHaveAttribute("href", "/people/1");
    // Not rows of their own - the links are the tab stops
    expect(bodyRows()[0]).not.toHaveAttribute("tabindex");
    expect(
      screen.queryByRole("link", { name: "Cyril" }),
    ).not.toBeInTheDocument();

    await user.click(link);
    expect(navigate).toHaveBeenLastCalledWith("/people/1", { ctrlKey: false });
    expect(onRowClick).toHaveBeenCalledTimes(1);

    // A click elsewhere on the row follows the link
    fireEvent.click(screen.getByText("Second"));
    expect(navigate).toHaveBeenLastCalledWith("/people/2", { ctrlKey: false });
    expect(onRowClick).toHaveBeenCalledTimes(2);

    // `preventDefault()` in onRowClick stays on the page
    onRowClick.mockImplementation((_row, event: Event) =>
      event.preventDefault(),
    );
    await user.click(screen.getByText("First"));
    expect(navigate).toHaveBeenCalledTimes(2);

    // Enter on the link
    onRowClick.mockReset();
    screen.getByRole("link", { name: "Běla" }).focus();
    await user.keyboard("{Enter}");
    expect(navigate).toHaveBeenLastCalledWith("/people/2", { ctrlKey: false });
  });

  it("opens the link of a row in a new tab on a click of the middle button", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    // A router under a base path - its links add it
    function Link({ href, ...props }: LinkComponentProps) {
      return <a {...props} href={`/app${href}`} />;
    }
    const auxClick = (element: Element, button = 1) =>
      fireEvent(
        element,
        new MouseEvent("auxclick", { bubbles: true, button, cancelable: true }),
      );

    render(
      <UIProvider router={{ Link }}>
        <DataTable
          columns={columns}
          data={rows}
          getRowHref={(row) => (row.id === 3 ? undefined : `/people/${row.id}`)}
        />
      </UIProvider>,
    );

    // The browser does not scroll by the pointer - the press opens the link
    expect(fireEvent.mouseDown(screen.getByText("Second"), { button: 1 })).toBe(
      false,
    );
    auxClick(screen.getByText("Second"));
    expect(open).toHaveBeenCalledExactlyOnceWith(
      new URL("/app/people/2", window.location.href).href,
      "_blank",
      "noopener,noreferrer",
    );

    // The link itself, the right button and a row without a link are left
    // to the browser
    expect(
      fireEvent.mouseDown(screen.getByRole("link", { name: "Adam" }), {
        button: 1,
      }),
    ).toBe(true);
    auxClick(screen.getByRole("link", { name: "Adam" }));
    auxClick(screen.getByText("First"), 2);
    auxClick(screen.getByText("Third"));
    expect(fireEvent.mouseDown(screen.getByText("Third"), { button: 1 })).toBe(
      true,
    );
    expect(open).toHaveBeenCalledOnce();
  });

  it("opens the link of a row in a new tab on Ctrl, Cmd or Shift + click", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const navigate = vi.fn();
    const onRowClick = vi.fn();
    // A router under a base path - its links add it
    function Link({ href, onClick, ...props }: LinkComponentProps) {
      return (
        <a
          {...props}
          href={`/app${href}`}
          onClick={(event) => {
            onClick?.(event);
            if (event.defaultPrevented) return;
            event.preventDefault();
            navigate(href);
          }}
        />
      );
    }

    render(
      <UIProvider router={{ Link }}>
        <DataTable
          columns={columns}
          data={rows}
          getRowHref={(row) => `/people/${row.id}`}
          onRowClick={onRowClick}
        />
      </UIProvider>,
    );

    // Not passed on to the link - WebKit ignores the keys of a click the
    // page dispatches, the link would leave the page. `onRowClick` comes
    // first, as for a click on the link.
    fireEvent.click(screen.getByText("Second"), { ctrlKey: true });
    fireEvent.click(screen.getByText("Second"), { metaKey: true });
    fireEvent.click(screen.getByText("Second"), { shiftKey: true });
    expect(navigate).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledTimes(3);
    expect(open).toHaveBeenLastCalledWith(
      new URL("/app/people/2", window.location.href).href,
      "_blank",
      "noopener,noreferrer",
    );
    expect(onRowClick).toHaveBeenCalledTimes(3);
    expect(onRowClick).toHaveBeenLastCalledWith(
      rows[1],
      expect.objectContaining({ shiftKey: true }),
    );

    // `preventDefault()` in onRowClick stays on the page
    onRowClick.mockImplementation((_row, event: Event) =>
      event.preventDefault(),
    );
    fireEvent.click(screen.getByText("Third"), { ctrlKey: true });
    expect(open).toHaveBeenCalledTimes(3);
    onRowClick.mockReset();

    // A plain click is passed on
    fireEvent.click(screen.getByText("Third"));
    expect(navigate).toHaveBeenCalledExactlyOnceWith("/people/3");
    expect(onRowClick).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledTimes(3);
  });

  it("takes a Shift, Ctrl or middle click on selected text for a click", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const onRowClick = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={rows}
        getRowHref={(row) => (row.id === 3 ? undefined : `/people/${row.id}`)}
        onRowClick={onRowClick}
      />,
    );

    // Shift + click extends a selection into the row, Firefox selects the
    // cell for Ctrl + click - neither ends a drag
    const selection = window.getSelection()!;
    selection.selectAllChildren(screen.getByText("Third"));
    fireEvent.click(screen.getByText("Third"), { shiftKey: true });
    fireEvent.click(screen.getByText("Third"), { ctrlKey: true });
    expect(onRowClick).toHaveBeenCalledTimes(2);

    // Nor does the middle button on text selected before
    selection.selectAllChildren(screen.getByText("Second"));
    expect(fireEvent.mouseDown(screen.getByText("Second"), { button: 1 })).toBe(
      false,
    );
    fireEvent(
      screen.getByText("Second"),
      new MouseEvent("auxclick", {
        bubbles: true,
        button: 1,
        cancelable: true,
      }),
    );
    expect(open).toHaveBeenCalledExactlyOnceWith(
      new URL("/people/2", window.location.href).href,
      "_blank",
      "noopener,noreferrer",
    );

    // A plain click there ends selecting it
    fireEvent.click(screen.getByText("Second"));
    expect(onRowClick).toHaveBeenCalledTimes(2);
    selection.removeAllRanges();
  });

  it("renders no row again on a navigation", () => {
    const onRender = vi.fn();
    render(
      <Profiler id="table" onRender={onRender}>
        <DataTable
          columns={columns}
          data={rows}
          getRowHref={(row) => `/people/${row.id}`}
        />
      </Profiler>,
    );
    onRender.mockClear();

    act(() => browserNavigate("/people?page=2"));
    expect(onRender).not.toHaveBeenCalled();
  });
});
