import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ErrorBoundary from "./error-boundary";

/** Throws `thrown` while `crash` is set. */
function Page({ crash, thrown }: { crash: boolean; thrown?: unknown }) {
  if (crash) throw thrown;
  return <p>Page content</p>;
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    // React and the boundary report the caught errors
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["an empty string", ""],
  ])("catches a thrown %s", (_, thrown) => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <Page crash thrown={thrown} />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ cause: thrown }),
      expect.anything(),
    );
  });

  it("gives the fallback the error and a reset", async () => {
    const user = userEvent.setup();
    let crash = true;
    function Flaky() {
      if (crash) throw new Error("Cannot load");
      return <p>Page content</p>;
    }

    render(
      <ErrorBoundary
        fallback={(error, reset) => (
          <button
            onClick={() => {
              crash = false;
              reset();
            }}
            type="button"
          >
            {error.message} - retry
          </button>
        )}
      >
        <Flaky />
      </ErrorBoundary>,
    );

    await user.click(
      screen.getByRole("button", { name: "Cannot load - retry" }),
    );
    expect(screen.getByText("Page content")).toBeInTheDocument();
  });

  it("renders the children again when a reset key changes", () => {
    const { rerender } = render(
      <ErrorBoundary fallback={<p>Crashed</p>} resetKeys={["/a"]}>
        <Page crash={false} />
      </ErrorBoundary>,
    );

    // Navigating to a page that crashes - with the new key already
    rerender(
      <ErrorBoundary fallback={<p>Crashed</p>} resetKeys={["/b"]}>
        <Page crash />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Crashed")).toBeInTheDocument();

    rerender(
      <ErrorBoundary fallback={<p>Crashed</p>} resetKeys={["/b"]}>
        <Page crash={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Crashed")).toBeInTheDocument();

    rerender(
      <ErrorBoundary fallback={<p>Crashed</p>} resetKeys={["/c"]}>
        <Page crash={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Page content")).toBeInTheDocument();
  });

  it("shows the message of the error only in development", () => {
    const crash = () =>
      render(
        <ErrorBoundary>
          <Page crash thrown={new Error("relation users does not exist")} />
        </ErrorBoundary>,
      );

    const { unmount } = crash();
    expect(
      screen.getByText("relation users does not exist"),
    ).toBeInTheDocument();
    unmount();

    vi.stubEnv("NODE_ENV", "production");
    try {
      crash();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Something went wrong",
      );
      expect(screen.queryByText("relation users does not exist")).toBeNull();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
