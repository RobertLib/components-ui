import { act, render } from "@testing-library/react";
import { Activity, StrictMode, createRef, useImperativeHandle } from "react";
import { describe, expect, it, vi } from "vitest";
import type { RouterAdapter } from "../../../providers/router";
import UIProvider from "../../../providers/ui-provider";
import useDataTableQuery from "./use-data-table-query";

type QueryState = ReturnType<typeof useDataTableQuery>;

function Harness({
  ref,
  urlPrefix = "",
}: {
  ref: React.Ref<QueryState>;
  urlPrefix?: string;
}) {
  const state = useDataTableQuery({ syncWithUrl: true, urlPrefix });
  useImperativeHandle(ref, () => state, [state]);
  return <span>{state[0].page}</span>;
}

function content(
  mode: "hidden" | "visible",
  router: Partial<RouterAdapter>,
  children: React.ReactNode,
) {
  return (
    <StrictMode>
      <UIProvider router={router}>
        <Activity mode={mode}>{children}</Activity>
      </UIProvider>
    </StrictMode>
  );
}

describe("useDataTableQuery with Activity", () => {
  it.each(["/orders", "/invoices"])(
    "uses the location and navigation callback committed while hidden at %s",
    async (pathname) => {
      const ref = createRef<QueryState>();
      const previousNavigate = vi.fn();
      const navigate = vi.fn();
      const router = {
        navigate: previousNavigate,
        pathname: "/orders",
        search: "?page=2&account=old",
      };
      const child = <Harness ref={ref} />;
      const { rerender } = render(content("visible", router, child));
      const setQuery = ref.current![1];

      await act(async () => rerender(content("hidden", router, child)));
      const updated = { navigate, pathname, search: "?page=4&account=new" };
      await act(async () => rerender(content("hidden", updated, child)));
      await act(async () =>
        setQuery((query) => ({ ...query, page: query.page + 1 })),
      );

      expect(previousNavigate).not.toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledExactlyOnceWith(
        `${pathname}?page=5&account=new`,
        { replace: false },
      );
      await act(async () =>
        setQuery((query) => ({ ...query, page: query.page + 1 })),
      );
      expect(navigate).toHaveBeenLastCalledWith(
        `${pathname}?page=6&account=new`,
        { replace: false },
      );
    },
  );

  it("retains pending navigations across hiding and showing before the router catches up", async () => {
    const ref = createRef<QueryState>();
    const navigate = vi.fn();
    const router = { navigate, pathname: "/orders", search: "?page=2" };
    const child = <Harness ref={ref} />;
    const { rerender } = render(content("visible", router, child));
    const setQuery = ref.current![1];
    const nextPage = (query: QueryState[0]) => ({
      ...query,
      page: query.page + 1,
    });
    act(() => setQuery(nextPage));
    expect(navigate).toHaveBeenLastCalledWith("/orders?page=3", {
      replace: false,
    });

    await act(async () => rerender(content("hidden", router, child)));
    await act(async () => setQuery(nextPage));
    expect(navigate).toHaveBeenLastCalledWith("/orders?page=4", {
      replace: false,
    });
    rerender(content("visible", router, child));
    act(() => setQuery(nextPage));
    expect(navigate).toHaveBeenLastCalledWith("/orders?page=5", {
      replace: false,
    });

    // An earlier navigation arriving must not discard the newer ones.
    const caughtUp = { ...router, search: "?page=3" };
    await act(async () => rerender(content("hidden", caughtUp, child)));
    await act(async () => setQuery(nextPage));
    expect(navigate).toHaveBeenLastCalledWith("/orders?page=6", {
      replace: false,
    });
  });

  it("shares pending changes of hidden tables and keeps them when shown again", async () => {
    const a = createRef<QueryState>();
    const b = createRef<QueryState>();
    const navigate = vi.fn();
    const router = { navigate, pathname: "/orders", search: "?tab=all" };
    const children = (
      <>
        <Harness ref={a} urlPrefix="a_" />
        <Harness ref={b} urlPrefix="b_" />
      </>
    );
    const { rerender } = render(content("visible", router, children));
    const setA = a.current![1];
    const setB = b.current![1];

    await act(async () => rerender(content("hidden", router, children)));
    await act(async () => setA((query) => ({ ...query, page: 2 })));
    await act(async () => setB((query) => ({ ...query, page: 3 })));
    expect(navigate).toHaveBeenLastCalledWith(
      "/orders?tab=all&a_page=2&b_page=3",
      { replace: false },
    );

    rerender(content("visible", router, children));
    act(() => setA((query) => ({ ...query, page: query.page + 1 })));
    expect(navigate).toHaveBeenLastCalledWith(
      "/orders?tab=all&a_page=3&b_page=3",
      { replace: false },
    );
  });

  it("discards pending changes when the last hidden table really unmounts", async () => {
    const ref = createRef<QueryState>();
    const navigate = vi.fn();
    const router = { navigate, pathname: "/orders", search: "?page=2" };
    const child = <Harness ref={ref} />;
    const { rerender } = render(content("visible", router, child));
    const setQuery = ref.current![1];

    await act(async () => rerender(content("hidden", router, child)));
    await act(async () => setQuery((query) => ({ ...query, page: 8 })));
    await act(async () => rerender(content("hidden", router, null)));
    rerender(content("visible", router, child));
    act(() => ref.current![1]((query) => ({ ...query, page: query.page + 1 })));

    expect(navigate).toHaveBeenLastCalledWith("/orders?page=3", {
      replace: false,
    });
  });
});
