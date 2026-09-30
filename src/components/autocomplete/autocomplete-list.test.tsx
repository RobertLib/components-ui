import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import Autocomplete, { type AutocompleteOption } from ".";
import { defaultFilterOptions } from "./filter-options";
import type { LoadOptionsParams } from "./load-options";
import UIProvider from "../../providers/ui-provider";
import { getActiveElement } from "../overlay-stack";

const places = [
  { group: "Czechia", label: "Praha", value: "praha" },
  { group: "Czechia", label: "Brno", value: "brno" },
  { group: "Austria", label: "Wien", value: "wien" },
  { group: "Czechia", label: "Plzeň", value: "plzen" },
  { group: "Austria", label: "Graz", value: "graz" },
  { label: "Anywhere", value: "any" },
];

const combobox = (name: RegExp | string = /Place/) =>
  screen.getByRole("combobox", { name });

const optionNames = () =>
  screen.getAllByRole("option").map((option) => option.textContent);

const activeOption = () => {
  const id = screen.getByRole("combobox").getAttribute("aria-activedescendant");
  return id ? document.getElementById(id)?.textContent : null;
};

const many = Array.from({ length: 5000 }, (_, index) => ({
  label: `Option ${index + 1}`,
  value: index + 1,
}));

describe("Autocomplete option groups", () => {
  it("lists the options under the headings of their groups", async () => {
    const user = userEvent.setup();
    render(<Autocomplete label="Place" options={places} />);

    await user.click(combobox());

    // Options without a group first, then the groups in the order their
    // first options come in
    expect(optionNames()).toEqual([
      "Anywhere",
      "Praha",
      "Brno",
      "Plzeň",
      "Wien",
      "Graz",
    ]);

    const czechia = screen.getByRole("group", { name: "Czechia" });
    expect(
      within(czechia)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Praha", "Brno", "Plzeň"]);
    expect(
      within(screen.getByRole("group", { name: "Austria" })).getAllByRole(
        "option",
      ),
    ).toHaveLength(2);

    // The groups belong to the listbox
    const listbox = screen.getByRole("listbox");
    expect(listbox).toContainElement(czechia);
    expect(czechia.getAttribute("aria-labelledby")).toBe(
      screen.getByText("Czechia").id,
    );
  });

  it("moves the highlight across the groups from the keyboard", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Autocomplete label="Place" onChange={onChange} options={places} />);

    await user.click(combobox());
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(activeOption()).toBe("Plzeň");

    await user.keyboard("{ArrowDown}");
    expect(activeOption()).toBe("Wien");

    await user.keyboard("{ArrowUp}");
    expect(activeOption()).toBe("Plzeň");

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("plzen", null);
  });

  it("drops the groups the typed term leaves empty", async () => {
    const user = userEvent.setup();
    render(<Autocomplete label="Place" options={places} />);

    await user.type(combobox(), "r");

    expect(screen.getByRole("group", { name: "Czechia" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Austria" })).toBeInTheDocument();
    expect(optionNames()).toEqual(["Anywhere", "Praha", "Brno", "Graz"]);

    await user.type(combobox(), "n");
    expect(screen.queryByRole("group", { name: "Austria" })).toBeNull();
    expect(optionNames()).toEqual(["Brno"]);
  });

  it("reads the group of items of any shape with getOptionGroup", async () => {
    const user = userEvent.setup();
    const countries = [
      { code: "cz", name: "Czechia", region: "Central Europe" },
      { code: "fr", name: "France", region: "Western Europe" },
      { code: "sk", name: "Slovakia", region: "Central Europe" },
    ];
    render(
      <Autocomplete
        getOptionGroup={(country: (typeof countries)[number]) => country.region}
        getOptionLabel={(country) => country.name}
        getOptionValue={(country) => country.code}
        label="Country"
        multiple
        options={countries}
      />,
    );

    await user.click(combobox(/Country/));
    const central = screen.getByRole("group", { name: "Central Europe" });
    expect(
      within(central)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Czechia", "Slovakia"]);

    await user.click(screen.getByRole("option", { name: "Slovakia" }));
    expect(screen.getByRole("option", { name: "Slovakia" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("listbox")).toHaveAttribute(
      "aria-multiselectable",
      "true",
    );
  });

  it("adds the options of a page loaded later to their groups", async () => {
    const user = userEvent.setup();
    const people = Array.from({ length: 6 }, (_, index) => ({
      id: index + 1,
      name: `Person ${index + 1}`,
      team: index % 2 ? "Sales" : "Support",
    }));
    const loadOptions = vi.fn(
      async ({ offset, pageSize }: LoadOptionsParams) => ({
        items: people.slice(offset, offset + pageSize),
        total: people.length,
      }),
    );
    render(
      <Autocomplete
        getOptionGroup={(person: (typeof people)[number]) => person.team}
        label="Person"
        loadOptions={loadOptions}
        pageSize={3}
      />,
    );

    await user.click(combobox(/Person/));
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(3));

    // The last option loads the next page, as scrolling to it would
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(6));

    expect(
      within(screen.getByRole("group", { name: "Support" }))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Person 1", "Person 3", "Person 5"]);
    expect(
      within(screen.getByRole("group", { name: "Sales" }))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Person 2", "Person 4", "Person 6"]);
  });

  it("brings the heading into view with the first option of its group", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");
    render(<Autocomplete label="Place" options={places} />);

    await user.click(combobox());
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(activeOption()).toBe("Praha");

    const calls = scrollIntoView.mock.contexts.slice(-2);
    expect(calls[0]).toBe(screen.getByText("Czechia"));
    expect(calls[1]).toBe(screen.getByRole("option", { name: "Praha" }));
  });
});

describe("Autocomplete filterOptions and highlighting", () => {
  it("lists what filterOptions returns for the typed term", async () => {
    const user = userEvent.setup();
    const filterOptions = vi.fn(
      (options: AutocompleteOption[], search: string) =>
        options.filter((option) =>
          option.label.toLowerCase().startsWith(search.toLowerCase()),
        ),
    );
    render(
      <Autocomplete
        filterOptions={filterOptions}
        label="Place"
        options={places}
      />,
    );

    await user.type(combobox(), " pr ");
    expect(filterOptions).toHaveBeenLastCalledWith(
      expect.arrayContaining([expect.objectContaining({ value: "praha" })]),
      "pr",
    );
    // "Plzeň" contains no "pr" - the default filter would not find "Brno"
    // for "r" either way
    expect(optionNames()).toEqual(["Praha"]);
  });

  it("filters loaded options further with filterOptions", async () => {
    const user = userEvent.setup();
    render(
      <Autocomplete
        filterOptions={(options) =>
          options.filter((option) => option.value !== 2)
        }
        label="Person"
        loadOptions={async () => [
          { id: 1, name: "Anna" },
          { id: 2, name: "Bob" },
          { id: 3, name: "Cyril" },
        ]}
      />,
    );

    await user.click(combobox(/Person/));
    await waitFor(() => expect(optionNames()).toEqual(["Anna", "Cyril"]));
  });

  it("builds on defaultFilterOptions", () => {
    expect(
      defaultFilterOptions(places, " zi ").map((option) => option.label),
    ).toEqual([]);
    expect(
      defaultFilterOptions(places, "PLZEN").map((option) => option.label),
    ).toEqual(["Plzeň"]);
    expect(defaultFilterOptions(places, "")).toBe(places);
  });

  it("puts the matched part of the labels in bold, ignoring diacritics", async () => {
    const user = userEvent.setup();
    render(
      <Autocomplete
        highlightMatches
        label="City"
        options={[
          { label: "Zürich", value: "zurich" },
          { label: "Plzeň", value: "plzen" },
        ]}
      />,
    );

    await user.type(combobox(/City/), "zur");
    const option = screen.getByRole("option", { name: "Zürich" });
    expect(option.querySelector("b")?.textContent).toBe("Zür");

    await user.clear(combobox(/City/));
    await user.type(combobox(/City/), "zen");
    expect(
      screen.getByRole("option", { name: "Plzeň" }).querySelector("b")
        ?.textContent,
    ).toBe("zeň");
  });

  it("gives renderOption the typed term", async () => {
    const user = userEvent.setup();
    const renderOption = vi.fn(
      (option: AutocompleteOption, { search }: { search: string }) =>
        `${option.label} (${search})`,
    );
    render(
      <Autocomplete
        label="Place"
        options={places}
        renderOption={renderOption}
      />,
    );

    await user.type(combobox(), "wi");
    expect(screen.getByRole("option", { name: "Wien (wi)" })).toBeVisible();
  });
});

describe("Autocomplete virtualization", () => {
  it("renders only the options in view, with their place in the list", async () => {
    const user = userEvent.setup();
    render(<Autocomplete label="Number" options={many} virtualized />);

    await user.click(combobox(/Number/));
    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThan(10);
    expect(options.length).toBeLessThan(100);
    expect(options[0]).toHaveAttribute("aria-setsize", "5000");
    expect(options[0]).toHaveAttribute("aria-posinset", "1");

    // The room of the others is held by spacers no one sees
    const spacer = screen.getByRole("listbox").lastElementChild!;
    expect(spacer).toHaveAttribute("aria-hidden", "true");
    expect(parseFloat((spacer as HTMLElement).style.height)).toBeGreaterThan(
      100_000,
    );
  });

  it("keeps the highlighted option rendered wherever it is", async () => {
    const user = userEvent.setup();
    render(<Autocomplete asSelect label="Number" options={many} virtualized />);

    await user.click(combobox(/Number/));
    await user.keyboard("{End}");

    const last = screen.getByRole("option", { name: "Option 5000" });
    expect(combobox(/Number/)).toHaveAttribute(
      "aria-activedescendant",
      last.id,
    );
    expect(last).toHaveAttribute("aria-posinset", "5000");

    await user.keyboard("{ArrowUp}");
    expect(activeOption()).toBe("Option 4999");

    await user.keyboard("{Home}");
    expect(activeOption()).toBe("Option 1");
  });

  it("opens a select on its selection far down the list", async () => {
    const user = userEvent.setup();
    render(
      <Autocomplete
        asSelect
        defaultValue={4321}
        label="Number"
        options={many}
        virtualized
      />,
    );

    await user.click(combobox(/Number/));
    const selected = screen.getByRole("option", { name: "Option 4321" });
    expect(selected).toHaveAttribute("aria-selected", "true");
    expect(combobox(/Number/)).toHaveAttribute(
      "aria-activedescendant",
      selected.id,
    );
  });

  it("renders the options scrolled to", async () => {
    const user = userEvent.setup();
    render(<Autocomplete label="Number" options={many} virtualized />);

    await user.click(combobox(/Number/));
    const panel = screen.getByRole("listbox").parentElement!;
    // Options are 32px high until they are measured - the 101st starts at
    // 3200px
    Object.defineProperty(panel, "clientHeight", {
      configurable: true,
      value: 240,
    });
    Object.defineProperty(panel, "scrollTop", {
      configurable: true,
      value: 3200,
    });
    fireEvent.scroll(panel);

    await waitFor(() =>
      expect(
        screen.getByRole("option", { name: "Option 101" }),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole("option", { name: "Option 1" })).toBeNull();
    expect(screen.getByRole("option", { name: "Option 101" })).toHaveAttribute(
      "aria-posinset",
      "101",
    );
  });

  it("filters the whole list as the user types", async () => {
    const user = userEvent.setup();
    render(<Autocomplete label="Number" options={many} virtualized />);

    await user.type(combobox(/Number/), "4999");
    expect(optionNames()).toEqual(["Option 4999"]);
    expect(screen.getByRole("option")).toHaveAttribute("aria-setsize", "1");
  });

  it("keeps the groups of a virtualized list, with their headings", async () => {
    const user = userEvent.setup();
    const grouped = many.map((option) => ({
      ...option,
      group: option.value <= 2500 ? "Low" : "High",
    }));
    render(
      <Autocomplete asSelect label="Number" options={grouped} virtualized />,
    );

    await user.click(combobox(/Number/));
    const low = screen.getByRole("group", { name: "Low" });
    expect(within(low).getAllByRole("option")[0]).toHaveAttribute(
      "aria-setsize",
      "2500",
    );
    expect(screen.queryByRole("group", { name: "High" })).toBeNull();

    // The first option of the second group - its heading comes with it
    await user.keyboard("Option 2501");
    expect(activeOption()).toBe("Option 2501");
    const high = screen.getByRole("group", { name: "High" });
    expect(
      within(high).getByRole("option", { name: "Option 2501" }),
    ).toHaveAttribute("aria-posinset", "1");
  });

  it("says the size of a list that loads more is unknown", async () => {
    const user = userEvent.setup();
    render(
      <Autocomplete
        label="Number"
        loadOptions={async ({ offset, pageSize }) => ({
          items: many.slice(offset, offset + pageSize),
          total: many.length,
        })}
        virtualized
      />,
    );

    await user.click(combobox(/Number/));
    await waitFor(() =>
      expect(screen.getAllByRole("option")[0]).toHaveAttribute(
        "aria-setsize",
        "-1",
      ),
    );
  });
});

describe("Autocomplete PageUp / PageDown", () => {
  it.each([false, true])(
    "reveals and pages through options in a shadow root (asSelect: %s)",
    async (asSelect) => {
      const host = document.createElement("div");
      document.body.append(host);
      onTestFinished(() => host.remove());
      const shadow = host.attachShadow({ mode: "open" });
      const container = document.createElement("div");
      const portalRoot = document.createElement("div");
      shadow.append(container, portalRoot);
      const options = Array.from({ length: 25 }, (_, index) => ({
        label: `City ${index + 1}`,
        value: index + 1,
      }));
      const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");
      render(
        <UIProvider portalContainer={portalRoot}>
          <Autocomplete
            asSelect={asSelect}
            defaultValue={20}
            label="City"
            options={options}
          />
        </UIProvider>,
        { container },
      );
      const app = within(container);
      const popup = within(portalRoot);
      const input = app.getByRole("combobox");
      act(() => input.focus());
      if (asSelect) {
        fireEvent.keyDown(input, { composed: true, key: "ArrowDown" });
        const selected = popup.getByRole("option", { name: "City 20" });
        await waitFor(() =>
          expect(scrollIntoView.mock.contexts).toContain(selected),
        );
      }

      scrollIntoView.mockClear();
      fireEvent.keyDown(input, { composed: true, key: "ArrowDown" });
      const highlighted = popup.getByRole("option", {
        name: asSelect ? "City 21" : "City 1",
      });
      expect(scrollIntoView.mock.contexts).toContain(highlighted);
      const panel = popup.getByRole("listbox").parentElement!;
      Object.defineProperty(panel, "clientHeight", { value: 160 });
      vi.spyOn(highlighted, "getBoundingClientRect").mockReturnValue({
        height: 32,
      } as DOMRect);
      fireEvent.keyDown(input, { composed: true, key: "PageDown" });
      const paged = popup.getByRole("option", {
        name: asSelect ? "City 25" : "City 5",
      });
      expect(input).toHaveAttribute("aria-activedescendant", paged.id);
      expect(scrollIntoView.mock.contexts).toContain(paged);

      if (!asSelect) {
        // The clear button disappears; its keyboard focus returns to the input.
        const clear = app.getByRole("button", { name: "Clear" });
        act(() => clear.focus());
        fireEvent.click(clear);
        expect(getActiveElement(shadow)).toBe(input);
      }
    },
  );

  it("moves the highlight by a page, to the ends at most", async () => {
    const user = userEvent.setup();
    const cities = Array.from({ length: 25 }, (_, index) => ({
      label: `City ${index + 1}`,
      value: index + 1,
    }));
    render(<Autocomplete label="City" options={cities} />);

    await user.click(combobox(/City/));
    // A list without a height (jsdom) moves by ten options
    await user.keyboard("{PageDown}");
    expect(activeOption()).toBe("City 10");
    await user.keyboard("{PageDown}{PageDown}");
    expect(activeOption()).toBe("City 25");
    await user.keyboard("{PageUp}");
    expect(activeOption()).toBe("City 15");
    await user.keyboard("{PageUp}{PageUp}");
    expect(activeOption()).toBe("City 1");
  });

  it("moves by the options a view of the list holds", async () => {
    const user = userEvent.setup();
    const cities = Array.from({ length: 25 }, (_, index) => ({
      label: `City ${index + 1}`,
      value: index + 1,
    }));
    vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(160);
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      height: 32,
    } as DOMRect);
    render(<Autocomplete label="City" options={cities} />);

    await user.click(combobox(/City/));
    await user.keyboard("{ArrowDown}{PageDown}");
    // Five options in view - four on, one of them stays in view
    expect(activeOption()).toBe("City 5");
  });

  it("leaves the keys to the page while the list is closed", async () => {
    render(<Autocomplete label="City" options={places} />);
    const input = combobox(/City/);
    act(() => input.focus());
    // The focus of the user opens the list - close it first
    fireEvent.keyDown(input, { key: "Escape" });

    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "PageDown",
    });
    act(() => {
      input.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(false);
  });
});
