import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity, useState } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Header from "../components/ui/header";
import Link from "../components/ui/link";
import Tabs from "../components/ui/tabs";
import { cs } from "../i18n/ui/cs";
import ConfirmProvider from "../providers/confirm-provider";
import { confirmLeave, hasUnsavedChanges } from "../providers/navigation-guard";
import type { LinkComponentProps, RouterAdapter } from "../providers/router";
import { useRouter } from "../providers/ui-context";
import UIProvider from "../providers/ui-provider";
import useUnsavedChanges, {
  type UseUnsavedChangesOptions,
} from "./use-unsaved-changes";

/** A form page - its changes, links away and a save that navigates. */
function EditPage({
  dirty,
  options,
}: {
  dirty: boolean;
  options?: UseUnsavedChangesOptions;
}) {
  const { release } = useUnsavedChanges(dirty, options);
  const router = useRouter();

  return (
    <>
      <Link href="/orders">Orders</Link>
      <Link href="?tab=items">Items</Link>
      <Link href="/orders" onClick={(event) => event.preventDefault()}>
        Prevented
      </Link>
      <button onClick={() => router.navigate("/customers")} type="button">
        Customers
      </button>
      <button
        onClick={() => router.navigate("/orders/1/edit?page=2")}
        type="button"
      >
        Page 2
      </button>
      <button
        onClick={() => {
          release();
          router.navigate("/orders/1");
        }}
        type="button"
      >
        Save
      </button>
    </>
  );
}

/** A router adapter whose links and navigations the test sees. */
function createRouter() {
  const navigate = vi.fn<RouterAdapter["navigate"]>();
  const back = vi.fn();

  function RouterLink({ href, onClick, ...props }: LinkComponentProps) {
    return (
      <a
        {...props}
        href={href}
        onClick={(event) => {
          onClick?.(event);
          // A new tab is the browser's, as with a real router
          if (event.defaultPrevented || event.ctrlKey) return;
          event.preventDefault();
          navigate(href);
        }}
      />
    );
  }

  const router: RouterAdapter = {
    back,
    Link: RouterLink,
    navigate,
    pathname: "/orders/1/edit",
    search: "",
  };
  return { back, navigate, router };
}

function renderWithRouter(
  ui: React.ReactNode,
  { confirmProvider = true, locale = undefined as typeof cs | undefined } = {},
) {
  const { back, navigate, router } = createRouter();
  const result = render(
    <UIProvider locale={locale} router={router}>
      {confirmProvider ? <ConfirmProvider>{ui}</ConfirmProvider> : ui}
    </UIProvider>,
  );
  return { ...result, back, navigate };
}

const beforeUnload = () => {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

beforeEach(() => {
  window.history.replaceState(null, "", "/orders/1/edit");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useUnsavedChanges", () => {
  it("asks the browser before the page unloads while dirty", () => {
    const { rerender } = render(<EditPage dirty={false} />);
    expect(beforeUnload()).toBe(false);
    expect(hasUnsavedChanges()).toBe(false);

    rerender(<EditPage dirty />);
    expect(beforeUnload()).toBe(true);
    expect(hasUnsavedChanges()).toBe(true);

    // Saved - no question
    rerender(<EditPage dirty={false} />);
    expect(beforeUnload()).toBe(false);
  });

  it("stops asking when the form goes", () => {
    const { unmount } = render(<EditPage dirty />);
    unmount();

    expect(beforeUnload()).toBe(false);
    expect(hasUnsavedChanges()).toBe(false);
  });

  it("asks before a link of the library leaves the page", async () => {
    const user = userEvent.setup();
    const { navigate } = renderWithRouter(<EditPage dirty />);

    await user.click(screen.getByRole("link", { name: "Orders" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "Leave without saving?",
    });
    expect(dialog).toHaveAccessibleDescription(
      "The changes you made will be lost.",
    );
    expect(navigate).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(navigate).not.toHaveBeenCalled();
    expect(hasUnsavedChanges()).toBe(true);

    await user.click(screen.getByRole("link", { name: "Orders" }));
    await user.click(await screen.findByRole("button", { name: "Leave" }));
    // The link is followed by the router, as clicked
    expect(navigate).toHaveBeenCalledExactlyOnceWith("/orders");
    // Left - the page unloads without the browser's question too
    expect(hasUnsavedChanges()).toBe(false);
    expect(beforeUnload()).toBe(false);
  });

  it("lets links within the page and to other tabs go", async () => {
    const user = userEvent.setup();
    const { navigate } = renderWithRouter(<EditPage dirty />);

    // The query alone - a tab, a filter - stays on the page
    await user.click(screen.getByRole("link", { name: "Items" }));
    expect(navigate).toHaveBeenCalledWith("?tab=items");

    // A new tab keeps the page - the browser opens it (not jsdom)
    document.addEventListener("click", (event) => event.preventDefault(), {
      once: true,
    });
    fireEvent.click(screen.getByRole("link", { name: "Orders" }), {
      ctrlKey: true,
    });
    // A handler that keeps the page needs no question
    await user.click(screen.getByRole("link", { name: "Prevented" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("asks before navigate of the router leaves the page", async () => {
    const user = userEvent.setup();
    const { navigate } = renderWithRouter(<EditPage dirty />);

    // The URL state of a table on the page
    await user.click(screen.getByRole("button", { name: "Page 2" }));
    expect(navigate).toHaveBeenCalledExactlyOnceWith("/orders/1/edit?page=2");

    await user.click(screen.getByRole("button", { name: "Customers" }));
    expect(navigate).toHaveBeenCalledTimes(1);
    await user.click(await screen.findByRole("button", { name: "Leave" }));
    expect(navigate).toHaveBeenLastCalledWith("/customers");
  });

  it("asks before the back button of a Header", async () => {
    const user = userEvent.setup();
    const { back } = renderWithRouter(
      <>
        <Header back title="Order 1" />
        <EditPage dirty />
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(
      await screen.findByRole("button", { name: "Keep editing" }),
    );
    expect(back).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(await screen.findByRole("button", { name: "Leave" }));
    expect(back).toHaveBeenCalledOnce();
  });

  it("asks before the links of Tabs leave the page", async () => {
    const user = userEvent.setup();
    const { navigate } = renderWithRouter(
      <>
        <Tabs
          items={[
            { href: "/orders/1/edit", label: "Edit" },
            { href: "/orders/1/history", label: "History" },
          ]}
        />
        <EditPage dirty />
      </>,
    );

    await user.click(screen.getByRole("link", { name: "History" }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("follows a link gone meanwhile through the router", async () => {
    const user = userEvent.setup();

    // A menu that closes as an item is clicked
    function Menu() {
      const [open, setOpen] = useState(true);
      return open ? (
        <Link href="/invoices" onClick={() => setOpen(false)}>
          Invoices
        </Link>
      ) : null;
    }
    const { navigate } = renderWithRouter(
      <>
        <Menu />
        <EditPage dirty />
      </>,
    );

    await user.click(screen.getByRole("link", { name: "Invoices" }));
    await user.click(await screen.findByRole("button", { name: "Leave" }));
    expect(navigate).toHaveBeenCalledExactlyOnceWith("/invoices");
  });

  it("navigates right away when saved", async () => {
    const user = userEvent.setup();
    const { navigate, rerender } = renderWithRouter(<EditPage dirty />);

    // `release()` before the navigation of the same handler
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(navigate).toHaveBeenCalledExactlyOnceWith("/orders/1");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    // Changed again - it asks again
    const { router } = createRouter();
    rerender(
      <UIProvider router={{ ...router, navigate }}>
        <ConfirmProvider>
          <EditPage dirty={false} />
        </ConfirmProvider>
      </UIProvider>,
    );
    rerender(
      <UIProvider router={{ ...router, navigate }}>
        <ConfirmProvider>
          <EditPage dirty />
        </ConfirmProvider>
      </UIProvider>,
    );
    expect(hasUnsavedChanges()).toBe(true);
  });

  it("asks once for several forms with changes", async () => {
    const user = userEvent.setup();
    const { navigate } = renderWithRouter(
      <>
        <EditPage dirty />
        <EditPage dirty />
      </>,
    );

    await user.click(screen.getAllByRole("link", { name: "Orders" })[0]);
    expect(await screen.findAllByRole("alertdialog")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Leave" }));

    expect(navigate).toHaveBeenCalledExactlyOnceWith("/orders");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(hasUnsavedChanges()).toBe(false);
  });

  it("asks with the browser's confirm() without a ConfirmProvider", async () => {
    const user = userEvent.setup();
    const ask = vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    const { navigate } = renderWithRouter(<EditPage dirty />, {
      confirmProvider: false,
      locale: cs,
    });

    await user.click(screen.getByRole("link", { name: "Orders" }));
    expect(ask).toHaveBeenCalledWith(
      "Odejít bez uložení?\n\nProvedené změny se neuloží.",
    );
    expect(navigate).not.toHaveBeenCalled();

    ask.mockReturnValueOnce(true);
    await user.click(screen.getByRole("link", { name: "Orders" }));
    await act(async () => {});
    expect(navigate).toHaveBeenCalledWith("/orders");
  });

  it("asks in Czech in a ConfirmDialog", async () => {
    const user = userEvent.setup();
    renderWithRouter(<EditPage dirty />, { locale: cs });

    await user.click(screen.getByRole("link", { name: "Orders" }));
    expect(
      await screen.findByRole("alertdialog", { name: "Odejít bez uložení?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Pokračovat v úpravách" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Odejít" })).toBeInTheDocument();
  });

  it("asks a question of its own with onBeforeLeave", async () => {
    const user = userEvent.setup();
    const onBeforeLeave = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const { navigate } = renderWithRouter(
      <EditPage dirty options={{ onBeforeLeave }} />,
    );

    await user.click(screen.getByRole("link", { name: "Orders" }));
    await act(async () => {});
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Orders" }));
    await act(async () => {});
    expect(navigate).toHaveBeenCalledWith("/orders");
    expect(onBeforeLeave).toHaveBeenCalledTimes(2);
  });

  it("stays when the question fails", async () => {
    const user = userEvent.setup();
    const { navigate } = renderWithRouter(
      <EditPage
        dirty
        options={{
          onBeforeLeave: () => {
            throw new Error("No dialog");
          },
        }}
      />,
    );

    await user.click(screen.getByRole("link", { name: "Orders" }));
    await act(async () => {});
    expect(navigate).not.toHaveBeenCalled();
  });

  it("asks before plain links without a router, then follows them", async () => {
    const user = userEvent.setup();
    const follow = vi.fn((event: MouseEvent) => event.preventDefault());
    document.addEventListener("click", follow);
    render(
      <ConfirmProvider>
        <EditPage dirty />
      </ConfirmProvider>,
    );

    await user.click(screen.getByRole("link", { name: "Orders" }));
    expect(follow.mock.calls[0][0].defaultPrevented).toBe(true);
    await user.click(await screen.findByRole("button", { name: "Leave" }));
    // Clicked again - the browser goes there now
    const clicks = follow.mock.calls.map(([event]) => event.target);
    expect(clicks.at(-1)).toBe(screen.getByRole("link", { name: "Orders" }));
    document.removeEventListener("click", follow);
  });

  it("lets a router's blocker ask with confirmLeave()", async () => {
    const user = userEvent.setup();
    expect(await confirmLeave()).toBe(true);
    render(
      <ConfirmProvider>
        <EditPage dirty />
      </ConfirmProvider>,
    );

    let answer: boolean | undefined;
    act(() => {
      void confirmLeave().then((leave) => {
        answer = leave;
      });
    });
    await user.click(await screen.findByRole("button", { name: "Leave" }));
    expect(answer).toBe(true);
    expect(hasUnsavedChanges()).toBe(false);
  });

  it("asks before back and forward with the Navigation API", async () => {
    const user = userEvent.setup();
    const traverseTo = vi.fn(() => ({
      committed: Promise.resolve(),
      finished: Promise.resolve(),
    }));
    const navigation = Object.assign(new EventTarget(), { traverseTo });
    vi.stubGlobal("navigation", navigation);
    render(
      <ConfirmProvider>
        <EditPage dirty />
      </ConfirmProvider>,
    );

    const traverse = (url: string, cancelable = true) => {
      const event = Object.assign(new Event("navigate", { cancelable }), {
        destination: { key: "previous", sameDocument: true, url },
        navigationType: "traverse",
      });
      act(() => {
        navigation.dispatchEvent(event);
      });
      return event;
    };

    // Within the page, or not to be stopped - the browser goes
    expect(
      traverse(`${location.origin}/orders/1/edit#lines`).defaultPrevented,
    ).toBe(false);
    expect(traverse(`${location.origin}/orders`, false).defaultPrevented).toBe(
      false,
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    expect(traverse(`${location.origin}/orders`).defaultPrevented).toBe(true);
    await user.click(await screen.findByRole("button", { name: "Leave" }));
    expect(traverseTo).toHaveBeenCalledExactlyOnceWith("previous");
  });

  it("lets a form submitted to the server go", () => {
    render(
      <form action="/orders/1" method="post">
        <EditPage dirty />
      </form>,
    );

    const form = document.querySelector("form")!;
    form.addEventListener("submit", (event) => event.preventDefault(), {
      once: true,
    });
    // A script handles the submit - still unsaved
    fireEvent.submit(form);
    expect(hasUnsavedChanges()).toBe(true);

    // jsdom submits nothing - the default prevented after the guard saw it
    window.addEventListener("submit", (event) => event.preventDefault(), {
      once: true,
    });
    fireEvent.submit(form);
    expect(hasUnsavedChanges()).toBe(false);
    expect(beforeUnload()).toBe(false);
  });

  it("keeps asking for a form Activity hides", () => {
    function Page({ mode }: { mode: "hidden" | "visible" }) {
      return (
        <Activity mode={mode}>
          <EditPage dirty />
        </Activity>
      );
    }
    const { rerender } = render(<Page mode="visible" />);
    rerender(<Page mode="hidden" />);

    expect(hasUnsavedChanges()).toBe(true);
  });

  it("renders on the server", () => {
    function Page() {
      const [dirty] = useState(true);
      useUnsavedChanges(dirty);
      return <p>Form</p>;
    }

    expect(renderToString(<Page />)).toBe("<p>Form</p>");
    expect(hasUnsavedChanges()).toBe(false);
  });
});
