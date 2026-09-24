import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import Autocomplete, { type AutocompleteValue } from ".";
import Field from "../field";
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
            onChange={setValue}
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

    expect(onChange).toHaveBeenLastCalledWith(
      ["praha", "zurich"],
      [null, null],
    );
    expect(screen.getByRole("button", { name: "Clear Zürich" })).toHaveFocus();

    await user.keyboard("{Delete}");
    expect(onChange).toHaveBeenLastCalledWith(["praha"], [null]);
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
    expect(loadSelectedOptions).toHaveBeenCalledWith([3, 5], {
      signal: expect.any(AbortSignal),
    });
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
            onChange={setValue}
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

const statuses = [
  { label: "Active", value: "active" },
  { label: "Archived", value: "archived" },
  { label: "Invited", value: "invited" },
  { label: "Suspended", value: "suspended" },
];

describe("Autocomplete as a select", () => {
  it("is a combobox that is neither read-only nor autocompleting", () => {
    render(<Autocomplete asSelect label="Status" options={statuses} />);

    const combobox = screen.getByRole("combobox", { name: "Status:" });
    expect(combobox).not.toHaveAttribute("readonly");
    expect(combobox).not.toHaveAttribute("aria-readonly");
    expect(combobox).not.toHaveAttribute("aria-autocomplete");
  });

  it("picks the highlighted option with Space, like Enter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Autocomplete
        asSelect
        label="Status"
        onChange={onChange}
        options={statuses}
      />,
    );

    const combobox = screen.getByRole("combobox", { name: "Status:" });
    act(() => combobox.focus());
    await user.keyboard(" ");
    expect(combobox).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{ArrowDown}{ArrowDown} ");
    expect(onChange).toHaveBeenLastCalledWith("archived", null);
    expect(combobox).toHaveAttribute("aria-expanded", "false");
    expect(combobox).toHaveTextContent("Archived");

    // Opened again on the selection, both close the list - picking it again
    // is no change
    await user.keyboard(" ");
    await user.keyboard(" ");
    expect(combobox).toHaveAttribute("aria-expanded", "false");
    await user.keyboard("{Enter}{Enter}");
    expect(combobox).toHaveAttribute("aria-expanded", "false");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("highlights the next option starting with the typed letters", async () => {
    const user = userEvent.setup();
    render(<Autocomplete asSelect label="Status" options={statuses} />);

    const combobox = screen.getByRole("combobox", { name: "Status:" });
    const highlighted = () =>
      document.getElementById(
        combobox.getAttribute("aria-activedescendant") ?? "",
      )?.textContent;

    act(() => combobox.focus());
    // Opens the list, like the arrow keys
    await user.keyboard("i");
    expect(combobox).toHaveAttribute("aria-expanded", "true");
    expect(highlighted()).toBe("Invited");

    // The same letter again moves on, around the end of the list
    await sleepPastTypeAhead();
    await user.keyboard("a");
    expect(highlighted()).toBe("Active");
    await user.keyboard("a");
    expect(highlighted()).toBe("Archived");
    await user.keyboard("a");
    expect(highlighted()).toBe("Active");

    // Letters in quick succession are one search
    await sleepPastTypeAhead();
    await user.keyboard("su");
    expect(highlighted()).toBe("Suspended");

    await user.keyboard("{Enter}");
    expect(combobox).toHaveTextContent("Suspended");
  });

  it("opens on its selection, which the arrow keys go on from", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");
    render(
      <Autocomplete
        asSelect
        defaultValue="archived"
        label="Status"
        options={statuses}
      />,
    );

    const combobox = screen.getByRole("combobox", { name: "Status:" });
    const highlighted = () =>
      document.getElementById(
        combobox.getAttribute("aria-activedescendant") ?? "",
      )?.textContent;

    act(() => combobox.focus());
    await user.keyboard("{Enter}");
    // What assistive technology reads - in view, however long the list
    expect(highlighted()).toBe("Archived");
    await waitFor(() =>
      expect(scrollIntoView.mock.contexts.at(-1)).toHaveTextContent("Archived"),
    );

    await user.keyboard("{ArrowDown}");
    expect(highlighted()).toBe("Invited");
  });

  it("takes its defaultValue back when the form is reset", async () => {
    const user = userEvent.setup();
    render(
      <form aria-label="Filter">
        <Autocomplete
          asSelect
          defaultValue="invited"
          label="Status"
          name="status"
          options={statuses}
        />
        <button type="reset">Reset</button>
      </form>,
    );

    const combobox = screen.getByRole("combobox", { name: "Status:" });
    await user.click(combobox);
    await user.click(screen.getByRole("option", { name: "Active" }));
    expect(combobox).toHaveTextContent("Active");

    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(combobox).toHaveTextContent("Invited");
    expect(Object.fromEntries(new FormData(screen.getByRole("form")))).toEqual({
      status: "invited",
    });
  });

  it("focuses the combobox from its label", async () => {
    const user = userEvent.setup();
    render(<Autocomplete asSelect label="Status" options={statuses} />);

    await user.click(screen.getByText("Status:"));
    expect(screen.getByRole("combobox", { name: "Status:" })).toHaveFocus();
  });

  it("shows its placeholder and submits the pick", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <Autocomplete
        asSelect
        hasEmpty
        label="Status"
        name="status"
        options={statuses}
        placeholder="Any status"
      />,
    );

    const combobox = screen.getByRole("combobox", { name: "Status:" });
    expect(combobox).toHaveTextContent("Any status");

    await user.click(combobox);
    // The blank option has a name
    await user.click(screen.getByRole("option", { name: "No selection" }));
    expect(combobox).toHaveTextContent("Any status");

    await user.click(combobox);
    await user.click(screen.getByRole("option", { name: "Invited" }));
    expect(combobox).toHaveTextContent("Invited");
    expect(
      container.querySelector("input[type=hidden][name=status]"),
    ).toHaveValue("invited");
  });

  it("says that it is loading or found nothing below its empty option", async () => {
    const user = userEvent.setup();
    let resolve: (items: typeof people) => void = () => {};
    const loadOptions = vi.fn(
      () =>
        new Promise<typeof people>((done) => {
          resolve = done;
        }),
    );

    render(
      <Autocomplete
        asSelect
        hasEmpty
        label="Person"
        loadOptions={loadOptions}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Person:" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Loading…"),
    );

    await act(async () => resolve([]));
    expect(screen.getByRole("status")).toHaveTextContent("No results");
    expect(screen.getAllByRole("option")).toHaveLength(1);
  });
});

/** Waits until the next letter typed into a select starts a new search. */
const sleepPastTypeAhead = () => act(() => sleep(550));

describe("Autocomplete fields", () => {
  it("moves the focus into the input when the clear button is used from the keyboard", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Autocomplete
        defaultValue="praha"
        label="City"
        onChange={onChange}
        options={cities}
      />,
    );

    const input = screen.getByRole("combobox", { name: "City:" });
    act(() => screen.getByRole("button", { name: "Clear" }).focus());
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(null, null);
    expect(input).toHaveFocus();
    // The focus the field moves there itself does not open the list
    expect(input).toHaveAttribute("aria-expanded", "false");

    await user.click(input);
    await user.click(screen.getByRole("option", { name: "Plzeň" }));
    act(() => screen.getByRole("button", { name: "Clear" }).focus());
    await user.keyboard(" ");
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
  });

  it("shows where the keyboard focus is", () => {
    const { container } = render(
      <Autocomplete defaultValue="praha" label="City" options={cities} />,
    );

    const input = screen.getByRole("combobox", { name: "City:" });
    expect(input.parentElement).toHaveClass(
      "focus-within:ring-2",
      "focus-within:ring-primary-500",
    );
    expect(container.querySelector("button")).toHaveClass(
      "focus-visible:ring-2",
    );
  });

  it("puts the consumer's aria-describedby and aria-labelledby on the input", () => {
    const { container } = render(
      <>
        <p id="hint">Where to start</p>
        <span id="name">Town</span>
        <Autocomplete
          aria-describedby="hint"
          aria-labelledby="name"
          error="Pick a town"
          options={cities}
        />
      </>,
    );

    const input = screen.getByRole("combobox", { name: "Town" });
    expect(input).toHaveAccessibleDescription("Pick a town Where to start");
    expect(container.querySelector("[aria-describedby=hint]")).toBeNull();
  });

  it("puts the aria-invalid and aria-required of Field on the combobox", () => {
    render(
      <Field error="Pick a city" label="City" required>
        {(controlProps) => <Autocomplete {...controlProps} options={cities} />}
      </Field>,
    );

    const combobox = screen.getByRole("combobox", { name: /City/ });
    expect(combobox).toHaveAttribute("aria-invalid", "true");
    expect(combobox).toHaveAttribute("aria-required", "true");
    expect(combobox).toHaveAccessibleDescription("Pick a city");
    // Not on the element around it
    expect(combobox.parentElement!.closest("[aria-invalid]")).toBeNull();
  });

  // user-event takes everything in a disabled fieldset for disabled - the
  // browser leaves a select (an element with a role) and the field around
  // the input alone
  it("is disabled by a disabled fieldset around it", () => {
    const onChange = vi.fn();
    render(
      <fieldset disabled>
        <Autocomplete
          asSelect
          label="Status"
          onChange={onChange}
          options={statuses}
        />
        <Autocomplete label="City" onChange={onChange} options={cities} />
        <Autocomplete
          defaultValue={["praha"]}
          label="Cities"
          multiple
          onChange={onChange}
          options={cities}
        />
      </fieldset>,
    );

    const select = screen.getByRole("combobox", { name: "Status:" });
    expect(select).toHaveAttribute("aria-disabled", "true");
    expect(select).not.toHaveAttribute("tabindex");
    fireEvent.click(select);
    fireEvent.keyDown(select, { key: "Enter" });
    // A click on the field around the disabled input
    fireEvent.click(
      screen.getByRole("combobox", { name: "City:" }).parentElement!,
    );
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    // The chips are no buttons that remove their values
    expect(
      screen.queryByRole("button", { name: "Clear Praha" }),
    ).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("closes its list when disabled - also once enabled again", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Autocomplete label="City" options={cities} />);

    const input = screen.getByRole("combobox", { name: "City:" });
    await user.click(input);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    rerender(<Autocomplete disabled label="City" options={cities} />);
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    rerender(<Autocomplete label="City" options={cities} />);
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("does not nest the loading spinner in a paragraph", async () => {
    const user = userEvent.setup();
    render(
      <Autocomplete
        label="Person"
        loadOptions={() => new Promise<typeof people>(() => {})}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Person:" }));
    const status = screen.getByRole("status");
    await waitFor(() => expect(status).toHaveTextContent("Loading…"));
    // React warns about it once per test file - check the markup instead
    expect(status.querySelector("p div")).toBeNull();
  });

  it("reads static items of any shape with getOptionLabel / getOptionValue", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const countries = [
      { code: "cz", name: "Czechia" },
      { code: "at", name: "Austria" },
    ];

    render(
      <Autocomplete
        getOptionLabel={(country: (typeof countries)[number]) =>
          country.name.toUpperCase()
        }
        getOptionValue={(country) => country.code}
        label="Country"
        onChange={onChange}
        options={countries}
      />,
    );

    const input = screen.getByRole("combobox", { name: "Country:" });
    await user.type(input, "aus");
    await user.click(screen.getByRole("option", { name: "AUSTRIA" }));

    expect(onChange).toHaveBeenCalledWith("at", countries[1]);
    expect(input).toHaveValue("AUSTRIA");
  });

  it("renders only the rows the highlight moves between", async () => {
    const user = userEvent.setup();
    const renderOption = vi.fn(
      (option: { label: string }, { active }: { active: boolean }) =>
        `${option.label}${active ? " ←" : ""}`,
    );
    render(
      <Autocomplete
        label="City"
        options={cities}
        renderOption={renderOption}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "City:" }));
    renderOption.mockClear();

    await user.hover(screen.getByRole("option", { name: "Plzeň" }));
    expect(renderOption).toHaveBeenCalledTimes(1);
    await user.hover(screen.getByRole("option", { name: /Zürich/ }));
    expect(renderOption).toHaveBeenCalledTimes(3);
  });
});

describe("Autocomplete loading more static options", () => {
  it("calls loadMore right away when the options do not fill the list", async () => {
    const user = userEvent.setup();
    // The list is 240px high, its options 100px
    vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(240);
    vi.spyOn(Element.prototype, "scrollHeight", "get").mockReturnValue(100);

    function Paged() {
      const [count, setCount] = useState(1);
      return (
        <Autocomplete
          hasMore={count < 3}
          label="City"
          loadMore={async () => setCount((prev) => prev + 1)}
          options={cities.slice(0, count)}
        />
      );
    }

    render(<Paged />);
    await user.click(screen.getByRole("combobox", { name: "City:" }));
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(3));
  });

  it("does not call loadMore in a loop when it brings no options", async () => {
    const user = userEvent.setup();
    vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(240);
    vi.spyOn(Element.prototype, "scrollHeight", "get").mockReturnValue(100);
    const loadMore = vi.fn(async () => {});

    render(<Autocomplete label="City" loadMore={loadMore} options={cities} />);
    await user.click(screen.getByRole("combobox", { name: "City:" }));

    await waitFor(() => expect(loadMore).toHaveBeenCalledTimes(1));
    await act(() => sleep(100));
    expect(loadMore).toHaveBeenCalledTimes(1);
  });
});

describe("Autocomplete selected values", () => {
  const loadPerson = async (ids: AutocompleteValue[]) =>
    people.filter((person) => ids.includes(person.id));

  it("shows a value whose item did not load as it is, and removes it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const loadSelectedOptions = vi.fn(loadPerson);
    const { container } = render(
      <Autocomplete
        defaultValue={[3, 999]}
        label="People"
        loadOptions={pagePeople}
        loadSelectedOptions={loadSelectedOptions}
        maxSelections={2}
        multiple
        name="people"
        onChange={onChange}
      />,
    );

    expect(
      await screen.findByRole("button", { name: "Clear Person 3" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear 999" })).toBeVisible();
    // One request - the value it did not deliver is not asked for again
    expect(loadSelectedOptions).toHaveBeenCalledTimes(1);
    const input = screen.getByRole("combobox", { name: "People:" });
    expect(input).not.toHaveAttribute("readonly");

    act(() => input.focus());
    await user.keyboard("{Backspace}");
    expect(onChange).toHaveBeenLastCalledWith(
      [3],
      [{ id: 3, name: "Person 3" }],
    );
    expect(
      screen.queryByRole("button", { name: "Clear 999" }),
    ).not.toBeInTheDocument();
    expect(
      [...container.querySelectorAll("input[type=hidden]")].map(
        (hidden) => (hidden as HTMLInputElement).value,
      ),
    ).toEqual(["3"]);
    expect(loadSelectedOptions).toHaveBeenCalledTimes(1);
  });

  it("reports items in the order of the values", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Autocomplete
        defaultValue={[3, 999]}
        label="People"
        loadOptions={pagePeople}
        loadSelectedOptions={loadPerson}
        multiple
        onChange={onChange}
      />,
    );

    const input = screen.getByRole("combobox", { name: "People:" });
    await screen.findByRole("button", { name: "Clear 999" });
    await user.click(input);
    await user.click(await screen.findByRole("option", { name: "Person 7" }));

    expect(onChange).toHaveBeenLastCalledWith(
      [3, 999, 7],
      [{ id: 3, name: "Person 3" }, null, { id: 7, name: "Person 7" }],
    );
  });

  it("shows a single value whose item did not load as it is", async () => {
    render(
      <Autocomplete
        defaultValue={999}
        label="Person"
        loadOptions={pagePeople}
        loadSelectedOptions={async () => []}
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Person:" })).toHaveValue(
        "999",
      ),
    );
  });

  it("aborts loadSelectedOptions when it unmounts", () => {
    const loadSelectedOptions = vi.fn(
      (_ids: AutocompleteValue[], { signal }: { signal: AbortSignal }) =>
        new Promise<typeof people>(() => void signal),
    );
    const { unmount } = render(
      <Autocomplete
        defaultValue={[3]}
        label="People"
        loadOptions={pagePeople}
        loadSelectedOptions={loadSelectedOptions}
        multiple
      />,
    );

    const { signal } = loadSelectedOptions.mock.calls[0][1];
    expect(signal.aborted).toBe(false);
    unmount();
    expect(signal.aborted).toBe(true);
  });

  it("shows the labels in StrictMode, which runs the preload twice", async () => {
    const loadSelectedOptions = vi.fn(
      (ids: AutocompleteValue[], _params: { signal: AbortSignal }) =>
        loadPerson(ids),
    );
    render(
      <StrictMode>
        <Autocomplete
          defaultValue={[3]}
          label="People"
          loadOptions={pagePeople}
          loadSelectedOptions={loadSelectedOptions}
          multiple
        />
      </StrictMode>,
    );

    expect(
      await screen.findByRole("button", { name: "Clear Person 3" }),
    ).toBeInTheDocument();
    // The first run is aborted by the cleanup between the two
    expect(loadSelectedOptions).toHaveBeenCalledTimes(2);
    expect(loadSelectedOptions.mock.calls[0][1].signal.aborted).toBe(true);
  });
});

describe("Autocomplete option states", () => {
  const withDisabled = [
    { label: "Praha", value: "praha" },
    { disabled: true, label: "Plzeň", value: "plzen" },
    { label: "Zürich", value: "zurich" },
  ];

  it("skips disabled options from the keyboard and the mouse", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Autocomplete label="City" onChange={onChange} options={withDisabled} />,
    );

    const input = screen.getByRole("combobox", { name: "City:" });
    await user.click(input);
    const plzen = screen.getByRole("option", { name: "Plzeň" });
    expect(plzen).toHaveAttribute("aria-disabled", "true");

    await user.click(plzen);
    expect(onChange).not.toHaveBeenCalled();

    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(input).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "Zürich" }).id,
    );
    await user.keyboard("{ArrowUp}");
    expect(input).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "Praha" }).id,
    );
  });

  it("says when maxSelections is reached and offers only the selected options", async () => {
    const user = userEvent.setup();
    render(
      <Autocomplete
        defaultValue={["praha"]}
        label="Cities"
        maxSelections={2}
        multiple
        options={cities}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Cities:" }));
    expect(screen.getByRole("status")).not.toHaveTextContent(/up to/);

    await user.click(screen.getByRole("option", { name: "Plzeň" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "You can select up to 2 options.",
    );
    expect(screen.getByRole("option", { name: "Zürich" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("option", { name: "Praha" })).not.toHaveAttribute(
      "aria-disabled",
    );

    // Removing one makes room again
    await user.click(screen.getByRole("option", { name: "Praha" }));
    expect(screen.getByRole("option", { name: "Zürich" })).not.toHaveAttribute(
      "aria-disabled",
    );
  });

  it("tells options with the same value apart and warns about them", async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <>
        <Autocomplete
          label="City"
          options={[
            { label: "Praha", value: "x" },
            { label: "Plzeň", value: "x" },
            { label: "Zürich", value: "zurich" },
          ]}
        />
        <Autocomplete
          asSelect
          hasEmpty
          label="Region"
          options={[{ label: "None", value: "" }, ...cities]}
        />
      </>,
    );

    const city = screen.getByRole("combobox", { name: "City:" });
    await user.click(city);
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(city).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "Plzeň" }).id,
    );
    await user.keyboard("{Escape}");

    const region = screen.getByRole("combobox", { name: "Region:" });
    act(() => region.focus());
    await user.keyboard("{Enter}{ArrowDown}{ArrowDown}");
    expect(region).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "None" }).id,
    );

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"x"'));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('""'));
    // No two rows with one key
    expect(error).not.toHaveBeenCalled();
  });
});

describe("Autocomplete keyboard and focus details", () => {
  const never = () => new Promise<typeof people>(() => {});

  it("leaves the keys of an input method editor alone", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Autocomplete label="City" onChange={onChange} options={cities} />);

    const input = screen.getByRole("combobox", { name: "City:" });
    await user.click(input);

    // A candidate picked with the arrows (Safari: key code 229)
    fireEvent.keyDown(input, { key: "ArrowDown", keyCode: 229 });
    expect(input).not.toHaveAttribute("aria-activedescendant");

    await user.keyboard("{ArrowDown}");
    // Enter confirming the conversion
    fireEvent.keyDown(input, { isComposing: true, key: "Enter" });
    fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("praha", null);
  });

  it("removes no value with Backspace while the chips are loading", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Autocomplete
        defaultValue={[3, 5]}
        label="People"
        loadOptions={never}
        loadSelectedOptions={never}
        multiple
        onChange={onChange}
      />,
    );

    const input = screen.getByRole("combobox", { name: "People:" });
    act(() => input.focus());
    await user.keyboard("{Backspace}");

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("Loading selected values…")).toBeInTheDocument();
  });

  it("does not toggle the list on Enter or Space while the labels load", async () => {
    const user = userEvent.setup();
    render(
      <Autocomplete
        defaultValue={3}
        label="Person"
        loadOptions={never}
        loadSelectedOptions={never}
      />,
    );

    const input = screen.getByRole("combobox", { name: "Person:" });
    expect(input).toHaveAttribute("readonly");
    await user.click(input);
    expect(input).toHaveAttribute("aria-expanded", "true");

    await user.keyboard(" ");
    expect(input).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Enter}");
    expect(input).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Escape}");
    await user.keyboard(" ");
    expect(input).toHaveAttribute("aria-expanded", "false");
    await user.keyboard("{Enter}");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("submits its form on Enter while the labels load", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Autocomplete
          defaultValue={3}
          label="Person"
          loadOptions={never}
          loadSelectedOptions={never}
        />
      </form>,
    );

    const input = screen.getByRole("combobox", { name: "Person:" });
    await user.tab();
    expect(input).toHaveFocus();
    await user.keyboard("{Escape}{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("opens only on the focus the user moves into the input", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <form>
        <Autocomplete
          defaultValue={["praha"]}
          label="Stops"
          multiple
          options={cities}
          required
        />
      </form>,
    );

    const input = screen.getByRole("combobox", { name: /Stops/ });
    const chip = screen.getByRole("button", { name: "Clear Praha" });

    await user.tab();
    expect(chip).toHaveFocus();
    expect(input).toHaveAttribute("aria-expanded", "false");

    // The last chip removed from the keyboard - the focus moves to the input
    await user.keyboard("{Delete}");
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-expanded", "false");

    // The browser focuses the invalid field on submit
    const validation =
      container.querySelector<HTMLInputElement>("input[required]")!;
    act(() => input.blur());
    fireEvent.invalid(validation);
    act(() => validation.focus());
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-expanded", "false");

    act(() => input.blur());
    await user.tab();
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps its validation input from the focus and assistive technology until it is invalid", async () => {
    const { container } = render(
      <Autocomplete label="City" options={cities} required />,
    );

    const validation = container.querySelector("input[required]")!;
    expect(validation).toHaveAttribute("inert");
    expect(validation).not.toHaveAttribute("aria-hidden");

    // The browser can then focus it and show its message
    fireEvent.invalid(validation);
    expect(validation).not.toHaveAttribute("inert");
    await waitFor(() => expect(validation).toHaveAttribute("inert"));
  });

  it("asks loadSelectedOptions again when the list next opens after it failed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    const loadSelectedOptions = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue([{ id: 3, name: "Person 3" }]);

    render(
      <>
        <Autocomplete
          defaultValue={[3]}
          label="People"
          loadOptions={async () => []}
          loadSelectedOptions={loadSelectedOptions}
          multiple
        />
        <button type="button">Outside</button>
      </>,
    );

    const input = screen.getByRole("combobox", { name: "People:" });
    expect(
      await screen.findByRole("button", { name: "Clear 3" }),
    ).toBeInTheDocument();

    // No retry in a loop
    await act(() => sleep(50));
    expect(loadSelectedOptions).toHaveBeenCalledTimes(1);

    // Asked again - and the field stays usable meanwhile
    await user.click(input);
    await waitFor(() => expect(loadSelectedOptions).toHaveBeenCalledTimes(2));
    expect(input).not.toHaveAttribute("readonly");
    await act(() => sleep(50));
    expect(loadSelectedOptions).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Clear 3" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Outside" }));
    await user.click(input);
    expect(
      await screen.findByRole("button", { name: "Clear Person 3" }),
    ).toBeInTheDocument();
    expect(loadSelectedOptions).toHaveBeenCalledTimes(3);
  });

  it("does not load the list when it unmounts right after opening", async () => {
    const loadOptions = vi.fn(pagePeople);
    const { unmount } = render(
      <Autocomplete label="Person" loadOptions={loadOptions} />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "Person:" }));
    unmount();

    await act(() => sleep(10));
    expect(loadOptions).not.toHaveBeenCalled();
  });

  it("leaves Enter in a closed typing field to the form, a select opens on it", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Autocomplete label="City" options={cities} />
        <Autocomplete asSelect label="Region" options={cities} />
        <button type="submit">Save</button>
      </form>,
    );

    const city = screen.getByRole("combobox", { name: "City:" });
    await user.click(city);
    await user.keyboard("{Escape}{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(city).toHaveAttribute("aria-expanded", "false");

    const region = screen.getByRole("combobox", { name: "Region:" });
    act(() => region.focus());
    await user.keyboard("{Enter}");
    expect(region).toHaveAttribute("aria-expanded", "true");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("belongs to the form its form prop names", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <>
        <form aria-label="Trip" id="trip">
          <button type="reset">Reset</button>
        </form>
        <Autocomplete
          defaultValue="praha"
          form="trip"
          label="City"
          name="city"
          options={cities}
          required
        />
      </>,
    );

    const form = screen.getByRole<HTMLFormElement>("form", { name: "Trip" });
    expect(Object.fromEntries(new FormData(form))).toEqual({ city: "praha" });
    expect(container.querySelector("input[required]")).toHaveAttribute(
      "form",
      "trip",
    );

    const input = screen.getByRole("combobox", { name: "City:" });
    await user.click(input);
    await user.click(screen.getByRole("option", { name: "Plzeň" }));
    expect(input).toHaveValue("Plzeň");

    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(input).toHaveValue("Praha");
  });
});
