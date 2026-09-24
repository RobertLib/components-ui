import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import CommandPalette, { type CommandPaletteItem } from ".";
import { cs } from "../../i18n/cs";
import UIProvider from "../../providers/ui-provider";

function createItems() {
  const newInvoice = vi.fn();
  const logOut = vi.fn();

  const items: CommandPaletteItem[] = [
    {
      group: "Navigation",
      href: "/customers",
      id: "customers",
      keywords: ["clients"],
      label: "Customers",
    },
    {
      group: "Navigation",
      href: "/invoices",
      id: "invoices",
      label: "Invoices",
    },
    { group: "Navigation", href: "/accounts", id: "accounts", label: "Účty" },
    {
      group: "Actions",
      id: "new-invoice",
      label: "New invoice",
      onSelect: newInvoice,
      shortcut: "mod+shift+i",
    },
    { disabled: true, group: "Actions", id: "export", label: "Export all" },
    { group: "Actions", id: "log-out", label: "Log out", onSelect: logOut },
  ];

  return { items, logOut, newInvoice };
}

/** Presses Ctrl + K - `mod+k` outside Apple platforms. */
const pressModK = (user: ReturnType<typeof userEvent.setup>) =>
  user.keyboard("{Control>}k{/Control}");

const getSearch = () => screen.getByRole("combobox");

/** The option the search points at as highlighted. */
function getActiveOption() {
  const id = getSearch().getAttribute("aria-activedescendant");
  return id ? document.getElementById(id) : null;
}

describe("CommandPalette", () => {
  it("opens with its shortcut - also from a text field - and closes with Escape", async () => {
    const user = userEvent.setup();
    const { items } = createItems();
    render(
      <>
        <input aria-label="Notes" />
        <CommandPalette items={items} />
      </>,
    );

    await user.click(screen.getByRole("textbox", { name: "Notes" }));
    await pressModK(user);

    expect(
      screen.getByRole("dialog", { name: "Command menu" }),
    ).toBeInTheDocument();
    expect(getSearch()).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Notes" })).toHaveFocus();
  });

  it("closes on its shortcut and starts with an empty search again", async () => {
    const user = userEvent.setup();
    const { items } = createItems();
    render(<CommandPalette items={items} />);

    await pressModK(user);
    await user.type(getSearch(), "inv");
    await pressModK(user);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await pressModK(user);
    expect(getSearch()).toHaveValue("");
  });

  it("works controlled, with a shortcut of its own or none", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { items } = createItems();

    function Page() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Search</button>
          <CommandPalette
            items={items}
            onOpenChange={(next) => {
              onOpenChange(next);
              setOpen(next);
            }}
            open={open}
            shortcut={null}
          />
        </>
      );
    }

    render(<Page />);
    await pressModK(user);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens on another shortcut", async () => {
    const user = userEvent.setup();
    render(<CommandPalette items={createItems().items} shortcut="/" />);

    await user.keyboard("/");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("lists the items in named groups with the first one highlighted", () => {
    render(<CommandPalette defaultOpen items={createItems().items} />);

    const search = getSearch();
    const listbox = screen.getByRole("listbox", { name: "Results" });
    expect(search).toHaveAccessibleName("Type a command or search…");
    expect(search).toHaveAttribute("aria-expanded", "true");
    expect(search).toHaveAttribute("aria-controls", listbox.id);

    const navigation = within(listbox).getByRole("group", {
      name: "Navigation",
    });
    expect(
      within(navigation)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Customers", "Invoices", "Účty"]);
    expect(
      within(listbox).getByRole("group", { name: "Actions" }),
    ).toBeInTheDocument();

    const first = screen.getByRole("option", { name: "Customers" });
    expect(getActiveOption()).toBe(first);
    expect(first).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "Export all" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("filters ignoring case and diacritics, also by keywords, and highlights the matches", async () => {
    const user = userEvent.setup();
    render(<CommandPalette defaultOpen items={createItems().items} />);

    await user.type(getSearch(), "UCTY");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    const accounts = screen.getByRole("option", { name: "Účty" });
    expect(accounts.querySelector("mark")).toHaveTextContent("Účty");
    // The group of the only result stays named
    expect(
      screen.getByRole("group", { name: "Navigation" }),
    ).toBeInTheDocument();
    // Announced once typing pauses - not on every keystroke
    expect(screen.getByRole("status")).not.toHaveTextContent("1 result");
    await vi.waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("1 result"),
    );

    await user.clear(getSearch());
    await user.type(getSearch(), "clients");
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Customers"]);
  });

  it("puts the group with the best match first, so Enter runs it", async () => {
    const user = userEvent.setup();
    const newCustomer = vi.fn();
    const contacts = vi.fn();
    render(
      <CommandPalette
        defaultOpen
        items={[
          {
            group: "Create",
            id: "customer",
            keywords: ["contact"],
            label: "New customer",
            onSelect: newCustomer,
          },
          {
            group: "Go to",
            id: "contacts",
            label: "Contacts",
            onSelect: contacts,
          },
        ]}
      />,
    );

    // Without a search the groups keep the order of their first item
    const groupNames = () =>
      screen
        .getAllByRole("group")
        .map((group) => group.firstElementChild?.textContent);
    expect(groupNames()).toEqual(["Create", "Go to"]);

    await user.type(getSearch(), "contact");
    expect(groupNames()).toEqual(["Go to", "Create"]);
    expect(getActiveOption()).toHaveTextContent("Contacts");

    await user.keyboard("{Enter}");
    expect(contacts).toHaveBeenCalledTimes(1);
    expect(newCustomer).not.toHaveBeenCalled();
  });

  it("puts the best matches of a group first", async () => {
    const user = userEvent.setup();
    render(
      <CommandPalette
        defaultOpen
        items={[
          { id: 1, label: "Reinvoicing" },
          { id: 2, label: "Overdue invoices" },
          { id: 3, label: "Invoices" },
        ]}
      />,
    );

    await user.type(getSearch(), "inv");
    expect(
      screen.getAllByRole("option").map((option) => option.textContent),
    ).toEqual(["Invoices", "Overdue invoices", "Reinvoicing"]);
    expect(getActiveOption()).toHaveTextContent("Invoices");
  });

  it("moves the highlight with the arrow keys, Home and End, past disabled items", async () => {
    const user = userEvent.setup();
    render(<CommandPalette defaultOpen items={createItems().items} />);

    await user.keyboard("{ArrowDown}");
    expect(getActiveOption()).toHaveTextContent("Invoices");

    await user.keyboard("{End}");
    expect(getActiveOption()).toHaveTextContent("Log out");
    expect(screen.getByRole("option", { name: "Log out" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // Export all is disabled
    await user.keyboard("{ArrowUp}");
    expect(getActiveOption()).toHaveTextContent("New invoice");

    // No wrapping around the ends
    await user.keyboard("{Home}{ArrowUp}");
    expect(getActiveOption()).toHaveTextContent("Customers");
  });

  it("runs the highlighted item with Enter and closes", async () => {
    const user = userEvent.setup();
    const { items, newInvoice } = createItems();
    render(<CommandPalette items={items} />);

    await pressModK(user);
    await user.type(getSearch(), "new");
    await user.keyboard("{Enter}");

    expect(newInvoice).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the page of an item through the router", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(
      <UIProvider router={{ navigate, pathname: "/", search: "" }}>
        <CommandPalette defaultOpen items={createItems().items} />
      </UIProvider>,
    );

    await user.keyboard("{ArrowDown}{Enter}");
    expect(navigate).toHaveBeenCalledWith("/invoices");
  });

  it("opens no javascript: link - also one loaded for the search", async () => {
    const user = userEvent.setup();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const navigate = vi.fn();
    const onSelect = vi.fn();
    render(
      <UIProvider router={{ navigate, pathname: "/", search: "" }}>
        <CommandPalette
          defaultOpen
          loadItems={async () => [
            {
              href: "javascript:alert(document.domain)",
              id: "site",
              label: "Website of ACME",
              onSelect,
            },
          ]}
        />
      </UIProvider>,
    );

    await user.click(await screen.findByRole("option", { name: /ACME/ }));

    // The command runs and the palette closes, but nothing is opened
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
    expect(errors).toHaveBeenCalledWith(
      "CommandPalette opens no href that is not a link:",
      "javascript:alert(document.domain)",
    );
  });

  it("highlights the option under the pointer and runs a clicked one", async () => {
    const user = userEvent.setup();
    const { items, logOut } = createItems();
    render(<CommandPalette defaultOpen items={items} />);

    const logOutOption = screen.getByRole("option", { name: "Log out" });
    fireEvent.mouseMove(logOutOption, { clientX: 10, clientY: 20 });
    expect(getActiveOption()).toBe(logOutOption);

    // A move without the pointer moving - Chrome after scrolling
    await user.keyboard("{Home}");
    fireEvent.mouseMove(logOutOption, { clientX: 10, clientY: 20 });
    expect(getActiveOption()).toHaveTextContent("Customers");

    // Disabled - nothing happens
    await user.click(screen.getByRole("option", { name: "Export all" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(getSearch()).toHaveFocus();

    await user.click(logOutOption);
    expect(logOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("says when nothing matches", async () => {
    const user = userEvent.setup();
    render(<CommandPalette defaultOpen items={createItems().items} />);

    await user.type(getSearch(), "zzz");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent("No results");
    expect(getSearch()).not.toHaveAttribute("aria-activedescendant");

    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows the shortcut of an item", () => {
    render(<CommandPalette defaultOpen items={createItems().items} />);

    const option = screen.getByRole("option", { name: /New invoice/ });
    expect(
      Array.from(option.querySelectorAll("kbd kbd"), (key) => key.textContent),
    ).toEqual(["Ctrl", "Shift", "I"]);
  });

  it("loads items for the search, after the matching items", async () => {
    const user = userEvent.setup();
    const loadItems = vi.fn((query: string) =>
      Promise.resolve(
        query
          ? [
              {
                description: "anna.novak@example.com",
                group: "People",
                href: "/people/1",
                id: 1,
                label: "Anna Nováková",
              },
            ]
          : [],
      ),
    );
    render(
      <CommandPalette
        defaultOpen
        items={[
          {
            group: "People",
            id: "all",
            label: "All people",
            keywords: ["anna"],
          },
        ]}
        loadItems={loadItems}
      />,
    );
    expect(loadItems).toHaveBeenCalledWith("", expect.anything());

    await user.type(getSearch(), "anna");
    // The matching items right away, the loaded ones once typing pauses
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");

    const loaded = await screen.findByRole("option", { name: /Anna Nováková/ });
    expect(loadItems).toHaveBeenLastCalledWith("anna", expect.anything());
    expect(loadItems).toHaveBeenCalledTimes(2);
    expect(loaded.querySelector("mark")).toHaveTextContent("Anna");
    expect(loaded).toHaveTextContent("anna.novak@example.com");
    expect(
      screen.getAllByRole("option").map((option) => option.id),
    ).toHaveLength(2);
    expect(screen.getAllByRole("option")[0]).toHaveTextContent("All people");
    expect(screen.getByRole("status")).toHaveTextContent("2 results");
  });

  it("aborts the loading of an outdated search", async () => {
    const user = userEvent.setup();
    const signals: AbortSignal[] = [];
    render(
      <CommandPalette
        defaultOpen
        loadItems={(_query, { signal }) => {
          signals.push(signal);
          return new Promise(() => {});
        }}
      />,
    );

    await user.type(getSearch(), "an");
    await vi.waitFor(() => expect(signals).toHaveLength(2));
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });

  it("says when loading failed", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onLoadError = vi.fn();
    const failure = new Error("HTTP 500");
    render(
      <CommandPalette
        defaultOpen
        loadItems={(query) =>
          query ? Promise.reject(failure) : Promise.resolve([])
        }
        onLoadError={onLoadError}
      />,
    );

    await user.type(getSearch(), "x");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The results could not be loaded.",
    );
    expect(onLoadError).toHaveBeenCalledWith(failure);
    expect(screen.getByRole("status")).not.toHaveTextContent("Loading");
  });

  it("speaks the language of the locale", async () => {
    const user = userEvent.setup();
    render(
      <UIProvider locale={cs}>
        <CommandPalette defaultOpen items={createItems().items} />
      </UIProvider>,
    );

    expect(
      screen.getByRole("dialog", { name: "Nabídka příkazů" }),
    ).toBeInTheDocument();
    expect(getSearch()).toHaveAccessibleName("Zadejte příkaz nebo hledejte…");

    await user.type(getSearch(), "faktur");
    expect(screen.getByRole("status")).toHaveTextContent("Žádné výsledky");
  });

  it("renders nothing on the server", () => {
    const { items } = createItems();

    // A server has no document
    vi.stubGlobal("document", undefined);
    const closed = renderToString(<CommandPalette items={items} />);
    const open = renderToString(<CommandPalette defaultOpen items={items} />);
    vi.unstubAllGlobals();

    expect(closed).toBe("");
    expect(open).toBe("");
  });
});

describe("CommandPalette after the review", () => {
  it("closes before a command runs, so a field the command focuses keeps the focus", async () => {
    const user = userEvent.setup();
    render(
      <>
        <input aria-label="Note" />
        <CommandPalette
          defaultOpen
          items={[
            {
              id: "note",
              label: "Go to the note",
              onSelect: () =>
                screen.getByRole("textbox", { name: "Note" }).focus(),
            },
          ]}
        />
      </>,
    );

    await user.keyboard("{Enter}");

    expect(screen.getByRole("textbox", { name: "Note" })).toHaveFocus();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("types a shortcut without a modifier into the search", async () => {
    const user = userEvent.setup();
    const { items } = createItems();
    render(<CommandPalette defaultOpen items={items} shortcut="/" />);

    await user.type(getSearch(), "a/b");

    expect(getSearch()).toHaveValue("a/b");
  });

  it("opens once while the shortcut is held", () => {
    const { items } = createItems();
    render(<CommandPalette items={items} />);

    fireEvent.keyDown(document, { ctrlKey: true, key: "k" });
    fireEvent.keyDown(document, { ctrlKey: true, key: "k", repeat: true });
    fireEvent.keyDown(document, { ctrlKey: true, key: "k", repeat: true });

    expect(getSearch()).toBeInTheDocument();
  });

  it("announces item shortcuts as aria-keyshortcuts, not in the name", () => {
    const { items } = createItems();
    render(<CommandPalette defaultOpen items={items} />);

    const option = screen.getByRole("option", { name: "New invoice" });
    expect(option).toHaveAttribute("aria-keyshortcuts", "Control+Shift+I");
  });
});
