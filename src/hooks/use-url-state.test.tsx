import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import useUrlState, { type UseUrlStateOptions } from "./use-url-state";
import UIProvider from "../providers/ui-provider";

const DEFAULTS = { page: "1", q: "", status: "active" };

/** The state of a list - its values, and buttons that change them. */
function List({
  onState,
  options,
}: {
  onState?: (state: typeof DEFAULTS) => void;
  options?: UseUrlStateOptions<typeof DEFAULTS>;
}) {
  const [state, update] = useUrlState(DEFAULTS, {
    resetOnChange: ["page"],
    ...options,
  });

  useEffect(() => onState?.(state), [onState, state]);

  return (
    <>
      <output>{JSON.stringify(state)}</output>
      <button onClick={() => update({ page: "3" })} type="button">
        Page 3
      </button>
      <button onClick={() => update({ status: "all" })} type="button">
        All
      </button>
      <button
        onClick={() => update({ q: "jana" }, { replace: true })}
        type="button"
      >
        Search
      </button>
      <button onClick={() => update({ status: "active" })} type="button">
        Active
      </button>
      <button
        onClick={() =>
          update((current) => ({ page: String(Number(current.page) + 1) }))
        }
        type="button"
      >
        Next page
      </button>
      <button
        onClick={() => update((current) => ({ ...current, status: "all" }))}
        type="button"
      >
        All of the current
      </button>
    </>
  );
}

/**
 * A router at `/members` - it shows a navigation at once, or with `late`
 * once "Finish" is pressed, like a router with loaders.
 */
function App({
  initialSearch = "",
  late = false,
  navigate,
  ...props
}: {
  initialSearch?: string;
  late?: boolean;
  navigate: (href: string, options?: { replace?: boolean }) => void;
} & React.ComponentProps<typeof List>) {
  const [search, setSearch] = useState(initialSearch);
  const [pending, setPending] = useState<string[]>([]);
  const show = (href: string) =>
    setSearch(href.includes("?") ? href.slice(href.indexOf("?")) : "");

  return (
    <UIProvider
      router={{
        navigate: (href, options) => {
          navigate(href, options);
          if (late) setPending((current) => [...current, href]);
          else show(href);
        },
        pathname: "/members",
        search,
      }}
    >
      <button
        onClick={() => {
          show(pending[pending.length - 1]);
          setPending([]);
        }}
        type="button"
      >
        Finish
      </button>
      {/* A parameter of another part of the page */}
      <button
        onClick={() => show(`/members${search ? `${search}&` : "?"}tab=2`)}
        type="button"
      >
        Other tab
      </button>
      <List {...props} />
    </UIProvider>
  );
}

const shown = () => JSON.parse(screen.getByRole("status").textContent!);

describe("useUrlState", () => {
  it("reads its values from the URL, the defaults where it has none", () => {
    render(<App initialSearch="?page=2&sort=name" navigate={vi.fn()} />);

    expect(shown()).toEqual({ page: "2", q: "", status: "active" });
  });

  it("writes a change into the URL, keeping the other parameters", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(<App initialSearch="?sort=name" navigate={navigate} />);

    await user.click(screen.getByRole("button", { name: "Page 3" }));
    expect(navigate).toHaveBeenLastCalledWith("/members?sort=name&page=3", {
      replace: false,
    });
    expect(shown().page).toBe("3");

    // A default is left out of the URL
    await user.click(screen.getByRole("button", { name: "Active" }));
    expect(navigate).toHaveBeenCalledOnce();
  });

  it("starts at the first page again once another value changes", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(<App initialSearch="?page=4" navigate={navigate} />);

    await user.click(screen.getByRole("button", { name: "All" }));
    expect(navigate).toHaveBeenLastCalledWith("/members?status=all", {
      replace: false,
    });
    expect(shown()).toEqual({ page: "1", q: "", status: "all" });
  });

  it("starts at the first page again also for a function passing the page on", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(<App initialSearch="?page=4" navigate={navigate} />);

    await user.click(
      screen.getByRole("button", { name: "All of the current" }),
    );
    expect(navigate).toHaveBeenLastCalledWith("/members?status=all", {
      replace: false,
    });
    expect(shown()).toEqual({ page: "1", q: "", status: "all" });
  });

  it("replaces the history entry when the update says so", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(<App navigate={navigate} />);

    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(navigate).toHaveBeenLastCalledWith("/members?q=jana", {
      replace: true,
    });
  });

  it("builds a change on the one the router does not show yet", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(<App late navigate={navigate} />);

    await user.click(screen.getByRole("button", { name: "All" }));
    await user.click(screen.getByRole("button", { name: "Page 3" }));
    expect(navigate).toHaveBeenLastCalledWith(
      "/members?status=all&page=3",
      expect.anything(),
    );

    await user.click(screen.getByRole("button", { name: "Finish" }));
    expect(shown()).toEqual({ page: "3", q: "", status: "all" });
  });

  it("builds a change of the values on the ones the router does not show yet", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(<App initialSearch="?page=2" late navigate={navigate} />);

    // Both clicks before the router shows the first - not page 3 twice
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(navigate).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenLastCalledWith(
      "/members?page=4",
      expect.anything(),
    );

    await user.click(screen.getByRole("button", { name: "Finish" }));
    expect(shown().page).toBe("4");
  });

  it("keeps a prefix of its parameters", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(
      <App
        initialSearch="?orders.page=2&page=9"
        navigate={navigate}
        options={{ prefix: "orders." }}
      />,
    );

    expect(shown().page).toBe("2");
    await user.click(screen.getByRole("button", { name: "All" }));
    expect(navigate).toHaveBeenLastCalledWith(
      "/members?page=9&orders.status=all",
      expect.anything(),
    );
  });

  it("keeps the same state object while its values stay", async () => {
    const user = userEvent.setup();
    const onState = vi.fn();
    render(
      <App initialSearch="?q=jana" navigate={vi.fn()} onState={onState} />,
    );

    // Another parameter of the URL changes - an effect on the state must
    // not fetch the list again
    await user.click(screen.getByRole("button", { name: "Other tab" }));
    expect(onState).toHaveBeenCalledOnce();
    expect(shown().q).toBe("jana");
  });

  it("builds on Back after a delayed router acknowledges the last of repeated queries", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    function Search() {
      const [state, update] = useUrlState({ q: "" });
      return (
        <>
          <output>{state.q}</output>
          <button
            onClick={() => {
              update({ q: "a" });
              update({ q: "b" });
              update({ q: "a" });
            }}
            type="button"
          >
            Search changes
          </button>
          <button
            onClick={() => update((current) => ({ q: `${current.q}x` }))}
            type="button"
          >
            Append
          </button>
        </>
      );
    }
    const view = (search: string) => (
      <UIProvider router={{ pathname: "/members", search, navigate }}>
        <Search />
      </UIProvider>
    );
    const { rerender } = render(view(""));
    await user.click(screen.getByRole("button", { name: "Search changes" }));
    expect(navigate.mock.calls.map(([href]) => href)).toEqual([
      "/members?q=a",
      "/members?q=b",
      "/members?q=a",
    ]);

    rerender(view("?q=a"));
    // Back is the next observed navigation: there is no intermediate render
    // that happens to clear the stale tail of pending queries.
    rerender(view("?q=b"));
    expect(screen.getByRole("status")).toHaveTextContent("b");
    await user.click(screen.getByRole("button", { name: "Append" }));
    expect(navigate).toHaveBeenLastCalledWith("/members?q=bx", {
      replace: false,
    });
  });
});
