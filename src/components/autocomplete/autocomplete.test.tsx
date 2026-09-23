import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import Autocomplete, { type AutocompleteValue } from ".";
import type { LoadOptionsParams } from "./load-options";

const cities = [
  { label: "Praha", value: "praha" },
  { label: "Plzeň", value: "plzen" },
  { label: "Zürich", value: "zurich" },
];

const people = Array.from({ length: 30 }, (_, index) => ({
  id: index + 1,
  name: `Person ${index + 1}`,
}));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A REST-like `loadOptions` paging `people` by offset. */
const pagePeople = async ({ offset, pageSize, search }: LoadOptionsParams) => {
  const matching = people.filter((person) =>
    person.name.toLowerCase().includes(search.toLowerCase()),
  );
  return {
    items: matching.slice(offset, offset + pageSize),
    total: matching.length,
  };
};

/** Pretends the open list was scrolled to its end. */
function scrollListToEnd() {
  const scroller = screen.getByRole("listbox").parentElement!;
  Object.defineProperty(scroller, "scrollHeight", {
    configurable: true,
    value: 500,
  });
  Object.defineProperty(scroller, "clientHeight", {
    configurable: true,
    value: 240,
  });
  Object.defineProperty(scroller, "scrollTop", {
    configurable: true,
    value: 260,
  });
  fireEvent.scroll(scroller);
}

describe("Autocomplete with static options", () => {
  it("filters ignoring diacritics and reports the pick", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Autocomplete label="City" onChange={onChange} options={cities} />);

    const input = screen.getByRole("combobox", { name: /City/ });
    await user.click(input);
    await user.type(input, "zur");

    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Zürich"]);

    await user.click(options[0]);
    expect(onChange).toHaveBeenCalledWith("zurich", null);
    expect(input).toHaveValue("Zürich");
  });

  it("follows a controlled value, including resets from outside", async () => {
    const user = userEvent.setup();

    function Controlled() {
      const [value, setValue] = useState<AutocompleteValue | null>("praha");
      return (
        <>
          <Autocomplete
            label="City"
            onChange={(next) => setValue(next as AutocompleteValue | null)}
            options={cities}
            value={value}
          />
          <button onClick={() => setValue("plzen")} type="button">
            set
          </button>
          <button onClick={() => setValue(null)} type="button">
            reset
          </button>
        </>
      );
    }

    render(<Controlled />);
    const input = screen.getByRole("combobox", { name: /City/ });
    expect(input).toHaveValue("Praha");

    await user.click(screen.getByRole("button", { name: "set" }));
    expect(input).toHaveValue("Plzeň");

    await user.click(screen.getByRole("button", { name: "reset" }));
    expect(input).toHaveValue("");
  });

  it("submits multiple values in hidden inputs and validates without a name", () => {
    const { container } = render(
      <Autocomplete
        defaultValue={["praha", "zurich"]}
        label="Cities"
        multiple
        name="cities"
        options={cities}
        required
      />,
    );

    const hidden = container.querySelectorAll<HTMLInputElement>(
      "input[type=hidden][name=cities]",
    );
    expect([...hidden].map((input) => input.value)).toEqual([
      "praha",
      "zurich",
    ]);

    const validation = container.querySelector("input[required]");
    expect(validation).not.toHaveAttribute("name");
    expect(validation).toHaveValue("valid");
  });

  it("neither submits nor validates a disabled field", () => {
    const { container } = render(
      <form>
        <Autocomplete
          defaultValue="praha"
          disabled
          label="City"
          name="city"
          options={cities}
        />
        <Autocomplete
          disabled
          label="Region"
          name="region"
          options={cities}
          required
        />
      </form>,
    );

    const form = container.querySelector("form")!;
    expect(form.checkValidity()).toBe(true);
    expect([...new FormData(form).keys()]).toEqual([]);
  });

  it("submits a cleared single field as empty, an empty multiple one not at all", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <form>
        <Autocomplete
          defaultValue="praha"
          label="City"
          name="city"
          options={cities}
        />
        <Autocomplete label="Stops" multiple name="stops" options={cities} />
      </form>,
    );

    const form = container.querySelector("form")!;
    expect([...new FormData(form).entries()]).toEqual([["city", "praha"]]);

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect([...new FormData(form).entries()]).toEqual([["city", ""]]);
  });

  it("is a combobox without a button wrapped around it", () => {
    render(<Autocomplete label="City" options={cities} />);

    const input = screen.getByRole("combobox", { name: /City/ });
    expect(input.closest("[role=button]")).toBeNull();
    expect(input.closest("[aria-haspopup]")).toBeNull();
  });

  it("opens its listbox without an unnamed dialog around it", async () => {
    render(<Autocomplete label="City" options={cities} />);

    await userEvent.click(screen.getByRole("combobox", { name: /City/ }));

    const listbox = await screen.findByRole("listbox");
    expect(listbox.closest("[role=dialog]")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens again on a click into the focused input after Escape or a pick", async () => {
    const user = userEvent.setup();
    render(<Autocomplete label="City" options={cities} />);
    const input = screen.getByRole("combobox", { name: /City/ });

    await user.click(input);
    await user.keyboard("{Escape}");
    expect(input).toHaveAttribute("aria-expanded", "false");
    await user.click(input);
    expect(input).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{ArrowDown}{Enter}");
    expect(input).toHaveValue("Praha");
    expect(input).toHaveAttribute("aria-expanded", "false");
    await user.click(input);
    expect(input).toHaveAttribute("aria-expanded", "true");
  });

  it("opens from the chevron and puts the focus into the input", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Autocomplete label="City" options={cities} />,
    );
    const input = screen.getByRole("combobox", { name: /City/ });
    const chevron = container.querySelector(".lucide-chevron-down")!;

    await user.click(chevron);
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveFocus();

    // Opens - a click does not toggle a typing field closed
    await user.click(chevron);
    expect(input).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps the focus in the input when an option is clicked", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Autocomplete label="City" options={cities} />
        <Autocomplete label="Stops" multiple options={cities} />
      </>,
    );

    const single = screen.getByRole("combobox", { name: /City/ });
    await user.click(single);
    await user.click(screen.getByRole("option", { name: "Plzeň" }));
    expect(single).toHaveValue("Plzeň");
    expect(single).toHaveFocus();

    const multiple = screen.getByRole("combobox", { name: /Stops/ });
    await user.click(multiple);
    await user.click(screen.getByRole("option", { name: "Praha" }));
    expect(multiple).toHaveFocus();
    await user.keyboard("zu");
    expect(multiple).toHaveValue("zu");
  });

  it("logs a rejected loadMore instead of leaving it unhandled", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const user = userEvent.setup();
    const loadMore = vi.fn().mockRejectedValue(new Error("offline"));
    render(<Autocomplete label="City" loadMore={loadMore} options={cities} />);

    await user.click(screen.getByRole("combobox", { name: /City/ }));
    scrollListToEnd();

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to load more options",
        expect.any(Error),
      ),
    );
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });
});

describe("Autocomplete forms", () => {
  it("takes its defaultValue back when the form is reset", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Trip">
        <Autocomplete
          defaultValue="praha"
          label="City"
          name="city"
          options={cities}
        />
        <Autocomplete
          defaultValue={["plzen"]}
          label="Stops"
          multiple
          name="stops"
          options={cities}
        />
        <button type="reset">Reset</button>
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Clear" }));
    const stops = screen.getByRole("combobox", { name: /Stops/ });
    await user.click(stops);
    await user.click(screen.getByRole("option", { name: "Zürich" }));
    await user.keyboard("pr");

    await user.click(screen.getByRole("button", { name: "Reset" }));

    const form = screen.getByRole<HTMLFormElement>("form", { name: "Trip" });
    expect([...new FormData(form).entries()]).toEqual([
      ["city", "praha"],
      ["stops", "plzen"],
    ]);
    expect(screen.getByRole("combobox", { name: /City/ })).toHaveValue("Praha");
    expect(stops).toHaveValue("");
  });

  it("is reset after a form action", async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    render(
      <form action={action}>
        <Autocomplete
          defaultValue="praha"
          label="City"
          name="city"
          options={cities}
        />
        <button type="submit">Save</button>
      </form>,
    );

    const input = screen.getByRole("combobox", { name: /City/ });
    await user.click(input);
    await user.click(screen.getByRole("option", { name: "Plzeň" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(input).toHaveValue("Praha"));
    expect(action.mock.calls[0][0].get("city")).toBe("plzen");
  });
});

describe("Autocomplete keyboard", () => {
  it("removes the focused chip with Backspace or Delete and keeps the focus", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Autocomplete
        defaultValue={["praha", "plzen", "zurich"]}
        label="Stops"
        multiple
        onChange={onChange}
        options={cities}
      />,
    );

    const plzen = screen.getByRole("button", { name: "Clear Plzeň" });
    plzen.focus();
    await user.keyboard("{Backspace}");

    expect(onChange).toHaveBeenLastCalledWith(["praha", "zurich"], []);
    expect(screen.getByRole("button", { name: "Clear Zürich" })).toHaveFocus();

    await user.keyboard("{Delete}");
    expect(onChange).toHaveBeenLastCalledWith(["praha"], []);
    expect(screen.getByRole("combobox", { name: /Stops/ })).toHaveFocus();
  });

  it("leaves the list alone on the arrow keys of a chip", async () => {
    const user = userEvent.setup();
    render(
      <Autocomplete
        defaultValue={["praha"]}
        label="Stops"
        multiple
        options={cities}
      />,
    );

    const input = screen.getByRole("combobox", { name: /Stops/ });
    await user.click(input);
    screen.getByRole("button", { name: "Clear Praha" }).focus();
    await user.keyboard("{ArrowDown}{End}");

    expect(input).not.toHaveAttribute("aria-activedescendant");
  });

  it("moves the caret on Home / End while typing, the highlight in a select", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Autocomplete label="City" options={cities} />
        <Autocomplete asSelect label="Region" options={cities} />
      </>,
    );

    const city = screen.getByRole("combobox", { name: /City/ });
    await user.click(city);
    await user.keyboard("{ArrowDown}{End}");
    expect(city).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "Praha" }).id,
    );
    await user.keyboard("{Escape}");

    const region = screen.getByRole("combobox", { name: /Region/ });
    await user.click(region);
    await user.keyboard("{End}");
    expect(region).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "Zürich" }).id,
    );
    await user.keyboard("{Home}");
    expect(region).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "Praha" }).id,
    );
  });

  it("drops the highlight of an option the new options no longer have", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Autocomplete label="City" options={cities} />);

    const input = screen.getByRole("combobox", { name: /City/ });
    await user.click(input);
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(input).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "Plzeň" }).id,
    );

    // Still there, at another place - the highlight goes with it
    rerender(<Autocomplete label="City" options={[...cities].reverse()} />);
    expect(input).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "Plzeň" }).id,
    );

    rerender(<Autocomplete label="City" options={[cities[0]]} />);
    expect(input).not.toHaveAttribute("aria-activedescendant");
    await user.keyboard("{Enter}");
    expect(input).toHaveValue("");
  });
});

describe("Autocomplete list states", () => {
  it("announces them beside the listbox, not as its options", async () => {
    const user = userEvent.setup();
    render(<Autocomplete label="City" options={cities} />);

    await user.click(screen.getByRole("combobox", { name: /City/ }));
    await user.keyboard("xyz");

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("No results");
    expect(screen.getByRole("listbox")).not.toContainElement(status);
    expect(screen.getByRole("listbox").children).toHaveLength(0);
  });

  it("stops calling loadMore once hasMore is false", async () => {
    const user = userEvent.setup();
    const loadMore = vi.fn().mockResolvedValue(undefined);
    render(
      <Autocomplete
        hasMore={false}
        label="City"
        loadMore={loadMore}
        options={cities}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: /City/ }));
    scrollListToEnd();
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");

    expect(loadMore).not.toHaveBeenCalled();
  });
});

describe("Autocomplete with loadOptions", () => {
  it("pages a REST-like API by offset and searches debounced", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const loadOptions = vi.fn(
      async ({ offset, pageSize, search }: LoadOptionsParams) => {
        const matching = people.filter((person) =>
          person.name.toLowerCase().includes(search.toLowerCase()),
        );
        return {
          items: matching.slice(offset, offset + pageSize),
          total: matching.length,
        };
      },
    );

    render(
      <Autocomplete
        label="Person"
        loadOptions={loadOptions}
        onChange={onChange}
        pageSize={10}
      />,
    );

    const input = screen.getByRole("combobox", { name: /Person/ });
    await user.click(input);

    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(10));
    expect(loadOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({
        after: null,
        cursor: null,
        first: 10,
        offset: 0,
        page: 1,
        pageSize: 10,
        search: "",
      }),
    );

    scrollListToEnd();
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(20));
    expect(loadOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 10, page: 2 }),
    );

    const callsBeforeTyping = loadOptions.mock.calls.length;
    await user.type(input, "Person 2");
    await waitFor(() =>
      expect(loadOptions).toHaveBeenLastCalledWith(
        expect.objectContaining({ offset: 0, page: 1, search: "Person 2" }),
      ),
    );
    // Debounced - one request for the whole term, not one per keystroke
    expect(loadOptions.mock.calls.length).toBe(callsBeforeTyping + 1);

    await user.click(await screen.findByRole("option", { name: "Person 25" }));
    expect(onChange).toHaveBeenCalledWith(25, { id: 25, name: "Person 25" });
  });

  it("pages a GraphQL connection by cursor", async () => {
    const user = userEvent.setup();
    const loadOptions = vi.fn(async ({ after, first }: LoadOptionsParams) => {
      const start = after ? Number(after) : 0;
      const nodes = people.slice(start, start + first);
      return {
        nodes,
        pageInfo: {
          endCursor: String(start + nodes.length),
          hasNextPage: start + first < people.length,
        },
      };
    });

    render(
      <Autocomplete label="Person" loadOptions={loadOptions} pageSize={10} />,
    );

    await user.click(screen.getByRole("combobox", { name: /Person/ }));
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(10));

    scrollListToEnd();
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(20));
    expect(loadOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ after: "10", cursor: "10", page: 2 }),
    );
  });

  it("ignores the response of a request a newer one replaced", async () => {
    const user = userEvent.setup();
    const pending: ((items: typeof people) => void)[] = [];
    const loadOptions = vi.fn(
      ({ signal }: LoadOptionsParams) =>
        new Promise<typeof people>((resolve) => {
          pending.push(resolve);
          signal.addEventListener("abort", () => {});
        }),
    );

    render(<Autocomplete label="Person" loadOptions={loadOptions} />);
    const input = screen.getByRole("combobox", { name: /Person/ });

    await user.click(input);
    await waitFor(() => expect(loadOptions).toHaveBeenCalledTimes(1));
    await user.type(input, "7");
    await waitFor(() => expect(loadOptions).toHaveBeenCalledTimes(2));
    expect(loadOptions.mock.calls[0][0].signal.aborted).toBe(true);

    // The newer answer arrives first, the stale one after it
    pending[1]([people[6]]);
    pending[0](people);

    await waitFor(() =>
      expect(
        screen.getAllByRole("option").map((option) => option.textContent),
      ).toEqual(["Person 7"]),
    );
  });

  it("loads the labels of saved values", async () => {
    const loadSelectedOptions = vi.fn(async (ids: AutocompleteValue[]) =>
      people.filter((person) => ids.includes(person.id)),
    );

    render(
      <Autocomplete
        defaultValue={[3, 5]}
        label="People"
        loadOptions={async () => people}
        loadSelectedOptions={loadSelectedOptions}
        multiple
      />,
    );

    expect(await screen.findByText(/Person 3/)).toBeInTheDocument();
    expect(screen.getByText(/Person 5/)).toBeInTheDocument();
    expect(loadSelectedOptions).toHaveBeenCalledWith([3, 5]);
  });

  it("keeps paging a cursor API that only returns the next cursor", async () => {
    const user = userEvent.setup();
    const loadOptions = vi.fn(async ({ cursor }: LoadOptionsParams) => {
      const start = cursor ? Number(cursor) : 0;
      const next = start + 10;
      return {
        items: people.slice(start, next),
        nextCursor: next < people.length ? String(next) : null,
      };
    });

    render(<Autocomplete label="Person" loadOptions={loadOptions} />);

    await user.click(screen.getByRole("combobox", { name: /Person/ }));
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(10));

    scrollListToEnd();
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(20));
    expect(loadOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: "10" }),
    );
  });

  it("shows a failed load and loads the list again when it next opens", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    const onLoadError = vi.fn();
    const loadOptions = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(people.slice(0, 3));

    render(
      <>
        <Autocomplete
          label="Person"
          loadOptions={loadOptions}
          onLoadError={onLoadError}
        />
        <button type="button">Outside</button>
      </>,
    );
    const input = screen.getByRole("combobox", { name: /Person/ });

    await user.click(input);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The options could not be loaded.",
    );
    expect(screen.queryByText("No results")).not.toBeInTheDocument();
    expect(onLoadError).toHaveBeenCalledTimes(1);

    // No retry while the list stays open - it would fail in a loop
    await act(() => sleep(50));
    expect(loadOptions).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Outside" }));
    await user.click(input);
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(3));
    expect(loadOptions).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a failed next page under the list and pages again when it next opens", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    let failNextPage = true;
    const loadOptions = vi.fn(async (params: LoadOptionsParams) => {
      if (params.offset > 0 && failNextPage) {
        failNextPage = false;
        throw new Error("offline");
      }
      return pagePeople(params);
    });

    render(
      <>
        <Autocomplete label="Person" loadOptions={loadOptions} pageSize={10} />
        <button type="button">Outside</button>
      </>,
    );
    const input = screen.getByRole("combobox", { name: /Person/ });

    await user.click(input);
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(10));
    scrollListToEnd();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(10);

    await user.click(screen.getByRole("button", { name: "Outside" }));
    await user.click(input);
    await waitFor(() => expect(loadOptions).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(10));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    scrollListToEnd();
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(20));
  });

  it("keeps the active option in view and pages from the keyboard", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");
    const loadOptions = vi.fn(pagePeople);

    render(
      <Autocomplete label="Person" loadOptions={loadOptions} pageSize={5} />,
    );
    const input = screen.getByRole("combobox", { name: /Person/ });

    await user.click(input);
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(5));

    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: "nearest" });
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(
      screen.getByRole("option", { name: "Person 2" }),
    );

    // Reaching the last option loads the next page, as scrolling to it would
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(10));
    expect(loadOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 5, page: 2 }),
    );

    await user.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "Person 6" }).id,
    );
  });

  it("loads the next page right away when a page does not fill the list", async () => {
    const user = userEvent.setup();
    // The list is 240px high, its three options 100px
    vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(240);
    vi.spyOn(Element.prototype, "scrollHeight", "get").mockReturnValue(100);
    const loadOptions = vi.fn(async ({ offset }: LoadOptionsParams) => ({
      hasMore: offset + 3 < 9,
      items: people.slice(offset, offset + 3),
    }));

    render(<Autocomplete label="Person" loadOptions={loadOptions} />);

    await user.click(screen.getByRole("combobox", { name: /Person/ }));
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(9));
    expect(loadOptions).toHaveBeenCalledTimes(3);
  });

  it("drops a debounced search when the term goes back or the list closes", async () => {
    const user = userEvent.setup();
    const loadOptions = vi.fn(pagePeople);

    render(<Autocomplete label="People" loadOptions={loadOptions} multiple />);
    const input = screen.getByRole("combobox", { name: /People/ });

    await user.click(input);
    await user.type(input, "Person 1");
    await waitFor(() =>
      expect(loadOptions).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "Person 1" }),
      ),
    );
    const calls = loadOptions.mock.calls.length;

    // Back to the term on screen before the debounce fires
    await user.type(input, "5{Backspace}");
    // Closed before the debounce fires
    await user.type(input, "7");
    await user.keyboard("{Escape}");
    await act(() => sleep(400));

    expect(loadOptions).toHaveBeenCalledTimes(calls);
  });

  it("keeps the label of a selected option only the list delivered", async () => {
    const user = userEvent.setup();
    const loadOptions = vi.fn(pagePeople);

    render(
      <>
        <Autocomplete
          defaultValue={3}
          label="Person"
          loadOptions={loadOptions}
        />
        <Autocomplete
          defaultValue={[3]}
          label="Team"
          loadOptions={loadOptions}
          multiple
        />
      </>,
    );

    const single = screen.getByRole("combobox", { name: /Person/ });
    await user.click(single);
    await waitFor(() => expect(single).toHaveValue("Person 3"));
    // A search the selection drops out of, then back to showing it
    await user.type(single, "0");
    await waitFor(() =>
      expect(loadOptions).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "Person 30" }),
      ),
    );
    await user.keyboard("{Escape}");
    expect(single).toHaveValue("Person 3");

    const multiple = screen.getByRole("combobox", { name: /Team/ });
    await user.click(multiple);
    expect(
      await screen.findByRole("button", { name: /Person 3$/ }),
    ).toBeInTheDocument();
    await user.type(multiple, "Person 2");
    await waitFor(() =>
      expect(loadOptions).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "Person 2" }),
      ),
    );
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(11));
    expect(
      screen.getByRole("button", { name: /Person 3$/ }),
    ).toBeInTheDocument();
  });

  it("does not preload the label of a value the list delivered", async () => {
    const user = userEvent.setup();
    const loadSelectedOptions = vi.fn(async () => []);

    function Controlled() {
      const [value, setValue] = useState<AutocompleteValue | null>(null);
      return (
        <>
          <Autocomplete
            label="Person"
            loadOptions={pagePeople}
            loadSelectedOptions={loadSelectedOptions}
            onChange={(next) => setValue(next as AutocompleteValue | null)}
            value={value}
          />
          <button onClick={() => setValue(5)} type="button">
            Pick 5
          </button>
        </>
      );
    }

    render(<Controlled />);
    const input = screen.getByRole("combobox", { name: /Person/ });

    await user.click(input);
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(30));
    await user.click(screen.getByRole("button", { name: "Pick 5" }));
    expect(input).toHaveValue("Person 5");

    await user.click(input);
    await user.type(input, "0");
    await waitFor(() => expect(screen.getByText("No results")).toBeVisible());

    expect(loadSelectedOptions).not.toHaveBeenCalled();
    expect(input).not.toHaveAttribute("readonly");
  });
});
