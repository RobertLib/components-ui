import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChangeHistory, {
  type ChangeHistoryEntry,
  type ChangeHistoryFilter,
} from ".";
import { cs } from "../../../i18n/ui/cs";
import UIProvider from "../../../providers/ui-provider";
import { diffWords, withContext } from "./word-diff";

// Thursday noon
const NOW = new Date(2026, 9, 15, 12, 0);

const jana = { id: 7, name: "Jana Nováková" };
const petr = { avatarUrl: "/petr.jpg", id: 8, name: "Petr Svoboda" };

const entries: ChangeHistoryEntry[] = [
  {
    action: "updated",
    author: jana,
    changes: [
      { field: "status", from: "draft", to: "sent" },
      { field: "total", from: 11_900, to: 12_400.5 },
      { field: "note", from: null, to: "Call first" },
    ],
    comment: "The customer asked for a discount.",
    id: 3,
    time: new Date(2026, 9, 15, 11, 55),
  },
  {
    action: "Approved",
    author: petr,
    changes: [{ field: "dueDate", from: "2026-10-30", to: "2026-11-06" }],
    id: 2,
    time: new Date(2026, 9, 14, 16, 45),
  },
  {
    action: "created",
    author: null,
    changes: [{ field: "paid", from: undefined, to: false }],
    id: 1,
    time: new Date(2026, 9, 1, 14, 30),
  },
];

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
});

afterEach(() => {
  vi.useRealTimers();
});

const entry = (name: string) =>
  screen.getByText(name, { selector: "[data-entry-id]" }).closest("li")!;

describe("ChangeHistory", () => {
  it("groups the entries by day under headings", () => {
    render(<ChangeHistory entries={entries} />);

    expect(
      screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
    ).toEqual(["Today", "Yesterday", "Thursday, October 1, 2026"]);
    // Each day is a list of its entries, named by its heading
    expect(screen.getByRole("list", { name: "Today" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Yesterday" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(1);
  });

  it("tells who did what and when", () => {
    render(<ChangeHistory entries={entries} />);

    const updated = entry("Jana Nováková");
    expect(within(updated).getByText("Updated")).toBeInTheDocument();
    const time = within(updated).getByText("5 minutes ago");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute(
      "dateTime",
      (entries[0].time as Date).toISOString(),
    );
    expect(time).toHaveAttribute("title", "10/15/2026 11:55 AM");
    expect(
      within(updated).getByText("The customer asked for a discount."),
    ).toBeInTheDocument();

    // A custom action as it is
    const approved = entry("Petr Svoboda");
    expect(within(approved).getByText("Approved")).toBeInTheDocument();
    expect(within(approved).getByText("19 hours ago")).toBeInTheDocument();
    expect(approved.querySelector("img")).toHaveAttribute("src", "/petr.jpg");

    // The system, at a time of day under the date of two weeks ago
    const created = entry("System");
    expect(within(created).getByText("Created")).toBeInTheDocument();
    expect(within(created).getByText("2:30 PM")).toBeInTheDocument();
  });

  it("writes the changed values in a table", () => {
    render(
      <ChangeHistory
        entries={entries}
        fields={{
          note: { label: "Note" },
          status: {
            formatValue: (value) => String(value).toUpperCase(),
            label: "Status",
          },
        }}
      />,
    );

    const table = within(entry("Jana Nováková")).getByRole("table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["Field", "Before", "After"]);

    const rows = within(table).getAllByRole("row").slice(1);
    expect(
      rows.map((row) =>
        within(row)
          .getAllByRole("cell")
          .map((cell) => cell.textContent),
      ),
    ).toEqual([
      ["DRAFT", "SENT"],
      ["11,900", "12,400.5"],
      // The empty value - "—", read as "empty"
      ["—empty", "Call first"],
    ]);
    expect(within(rows[0]).getByRole("rowheader")).toHaveTextContent("Status");
    expect(within(rows[1]).getByRole("rowheader")).toHaveTextContent("total");

    // Days by the locale, booleans as Yes / No
    expect(
      within(entry("Petr Svoboda")).getByText("11/06/2026"),
    ).toBeInTheDocument();
    expect(within(entry("System")).getByText("No")).toBeInTheDocument();
  });

  it("writes the values of every field by `formatValue`", () => {
    const formatValue = vi.fn((value: unknown) => `<${String(value)}>`);
    render(
      <ChangeHistory
        entries={[entries[1]]}
        fields={{ dueDate: { label: "Due date" } }}
        formatValue={formatValue}
      />,
    );
    expect(screen.getByText("<2026-11-06>")).toBeInTheDocument();
    expect(formatValue).toHaveBeenCalledWith(
      "2026-11-06",
      entries[1].changes![0],
      entries[1],
    );
  });

  it("compares a long text word by word - shortened around the changes", async () => {
    const user = userEvent.setup();
    const before =
      "Delivery to the warehouse in Brno on weekdays between eight and four, call the dispatcher half an hour ahead and use the north gate for trucks over twelve tonnes.";
    const after =
      "Delivery to the warehouse in Ostrava on weekdays between eight and four, call the dispatcher half an hour ahead and use the south gate for trucks over twelve tonnes.";
    render(
      <ChangeHistory
        entries={[
          {
            action: "updated",
            author: jana,
            changes: [{ field: "instructions", from: before, to: after }],
            id: 1,
            time: NOW,
          },
        ]}
      />,
    );

    const cell = screen.getByRole("cell", { name: /Ostrava/ });
    expect(cell).toHaveAttribute("colspan", "2");
    const removed = cell.querySelectorAll("del");
    const added = cell.querySelectorAll("ins");
    expect([...removed].map((part) => part.textContent)).toEqual([
      "removed: Brno",
      "removed: north",
    ]);
    expect([...added].map((part) => part.textContent)).toEqual([
      "added: Ostrava",
      "added: south",
    ]);
    // The words between the changes are shortened
    expect(cell).toHaveTextContent("…");
    expect(cell).not.toHaveTextContent("call the dispatcher");

    const toggle = within(cell).getByRole("button", { name: "Show all" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveTextContent("Show less");
    expect(cell).toHaveTextContent("call the dispatcher");
    expect(cell).not.toHaveTextContent("…");
  });

  it("filters by the field and the author", async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    render(
      <ChangeHistory
        entries={entries}
        fields={{ total: { label: "Total" } }}
        filterable
        onFilterChange={onFilterChange}
      />,
    );

    const field = screen.getByRole("combobox", { name: "Field" });
    expect(
      within(field)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["All fields", "status", "Total", "note", "dueDate", "paid"]);

    await user.selectOptions(field, "total");
    expect(onFilterChange).toHaveBeenLastCalledWith({
      author: undefined,
      field: "total",
    });
    // Only the entry that changed it - with only its change
    expect(screen.getAllByRole("table")).toHaveLength(1);
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByText("12,400.5")).toBeInTheDocument();

    await user.selectOptions(field, "");
    const author = screen.getByRole("combobox", { name: "Author" });
    expect(
      within(author)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["All authors", "Jana Nováková", "Petr Svoboda", "System"]);
    await user.selectOptions(author, "system");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(
      screen.getByText("System", { selector: "[data-entry-id]" }),
    ).toBeInTheDocument();

    await user.selectOptions(field, "total");
    expect(
      screen.getByRole("heading", { name: "No changes match the filter" }),
    ).toBeInTheDocument();
  });

  it("filters controlled", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [filter, setFilter] = useState<ChangeHistoryFilter>({
        author: "8",
      });
      return (
        <ChangeHistory
          entries={entries}
          filter={filter}
          filterable
          onFilterChange={setFilter}
        />
      );
    }
    render(<Controlled />);

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("combobox", { name: "Author" })).toHaveValue("8");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Author" }),
      "",
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("loads older entries - and tells when they have arrived", async () => {
    const user = userEvent.setup();
    let resolve: () => void = () => {};
    function Paged() {
      const [shown, setShown] = useState(entries.slice(0, 1));
      return (
        <ChangeHistory
          entries={shown}
          hasMore={shown.length < entries.length}
          onLoadMore={() =>
            new Promise<void>((done) => {
              resolve = () => {
                setShown(entries);
                done();
              };
            })
          }
        />
      );
    }
    render(<Paged />);

    const button = screen.getByRole("button", { name: "Load older changes" });
    await user.click(button);
    expect(button).toHaveAttribute("aria-disabled", "true");

    await act(async () => resolve());
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("Loaded 2 more changes.")).toBeInTheDocument();
    // The button is gone - the focus is on the first new entry
    expect(
      screen.queryByRole("button", { name: "Load older changes" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Petr Svoboda", { selector: "[data-entry-id]" }),
    ).toHaveFocus();
  });

  it("offers to try again when loading fails", async () => {
    const user = userEvent.setup();
    const onLoadMore = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network down"))
      .mockReturnValueOnce(undefined);
    render(<ChangeHistory entries={entries} hasMore onLoadMore={onLoadMore} />);

    await user.click(
      screen.getByRole("button", { name: "Load older changes" }),
    );
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Older changes could not be loaded.");
    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(onLoadMore).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows placeholders while loading and an empty state without entries", () => {
    const { rerender } = render(<ChangeHistory entries={[]} loading />);
    expect(screen.getByRole("list")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();

    rerender(<ChangeHistory entries={[]} />);
    expect(
      screen.getByRole("heading", { name: "No changes yet" }),
    ).toBeInTheDocument();

    rerender(<ChangeHistory empty={<p>Never edited</p>} entries={[]} />);
    expect(screen.getByText("Never edited")).toBeInTheDocument();
  });

  it("passes its ref and attributes on, with headings of the level given", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <ChangeHistory
        data-testid="history"
        entries={entries}
        headingLevel={4}
        ref={ref}
        size="sm"
      />,
    );
    expect(ref.current).toBe(screen.getByTestId("history"));
    expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(3);
  });

  it("speaks Czech", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider locale={cs}>
        <ChangeHistory
          entries={entries}
          filterable
          hasMore
          onLoadMore={() => {}}
        />
      </UIProvider>,
    );

    expect(
      screen.getAllByRole("heading").map((heading) => heading.textContent),
    ).toEqual(["Dnes", "Včera", "Čtvrtek 1. října 2026"]);
    expect(screen.getByText("Upraveno")).toBeInTheDocument();
    expect(screen.getByText("Vytvořeno")).toBeInTheDocument();
    expect(
      screen.getByText("Systém", { selector: "[data-entry-id]" }),
    ).toBeInTheDocument();
    expect(screen.getByText("před 5 minutami")).toBeInTheDocument();
    expect(screen.getByText("před 19 hodinami")).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("columnheader")
        .slice(0, 3)
        .map((header) => header.textContent),
    ).toEqual(["Pole", "Původně", "Nově"]);
    expect(screen.getByText("Ne")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Autor" })).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Pole" }),
      "",
    );
    expect(
      screen.getByRole("button", { name: "Načíst starší změny" }),
    ).toBeInTheDocument();
  });
});

describe("ChangeHistory on the server", () => {
  it("lists the entries without days until the zone of the user is known", () => {
    const html = renderToString(<ChangeHistory entries={entries} />);
    expect(html).not.toContain("<h3");
    expect(html).toContain("Jana Nováková");
  });

  it("hydrates without a mismatch - then shows the days and relative times", async () => {
    const page = (
      <UIProvider locale={cs}>
        <ChangeHistory entries={entries} filterable />
      </UIProvider>
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(page);
    document.body.append(container);
    const onRecoverableError = vi.fn();
    const consoleError = vi.spyOn(console, "error");

    const root = await act(async () =>
      hydrateRoot(container, page, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(
      within(container).getByRole("heading", { name: "Dnes" }),
    ).toBeInTheDocument();
    expect(within(container).getByText("před 5 minutami")).toBeInTheDocument();

    act(() => root.unmount());
    container.remove();
  });

  it("groups them by the days of a given zone", () => {
    const html = renderToString(
      <ChangeHistory entries={entries} timeZone="Europe/Prague" />,
    );
    // Today is not known yet on the server - the date is
    expect(html).toContain("Thursday, October 15, 2026");
  });
});

describe("diffWords", () => {
  it("marks the removed and the added words", () => {
    expect(diffWords("Pay within 14 days", "Pay within 30 days")).toEqual([
      { text: "Pay within ", type: "same" },
      { text: "14", type: "removed" },
      { text: "30", type: "added" },
      { text: " days", type: "same" },
    ]);
    expect(diffWords("", "New text")).toEqual([
      { text: "New text", type: "added" },
    ]);
    expect(diffWords("a b c", "a c")).toEqual([
      { text: "a ", type: "same" },
      { text: "b ", type: "removed" },
      { text: "c", type: "same" },
    ]);
  });

  it("shortens the unchanged words around the changes", () => {
    const words = Array.from({ length: 40 }, (_, index) => `w${index}`);
    const changed = [...words];
    changed[20] = "X";
    const parts = withContext(
      diffWords(words.join(" "), changed.join(" ")),
      3,
    )!;
    expect(parts.map((part) => ("text" in part ? part.text : "…"))).toEqual([
      "…",
      "w17 w18 w19 ",
      "w20",
      "X",
      " w21 w22 w23",
      "…",
    ]);
    expect(withContext(diffWords("a b", "a c"), 3)).toBeNull();
    expect(withContext(diffWords("same", "same"), 3)).toBeNull();
  });
});
