import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Header from "./header";
import { cs } from "../i18n/cs";
import UIProvider from "../providers/ui-provider";

describe("Header", () => {
  it("is the heading of the page with its actions", () => {
    render(
      <Header actions={<button type="button">New</button>} title="Orders" />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Orders" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
  });

  it("says the title is loading - the heading is never empty", () => {
    const { rerender } = render(<Header title={null} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Loading…" }),
    ).toBeInTheDocument();

    rerender(
      <UIProvider locale={cs}>
        <Header title={undefined} />
      </UIProvider>,
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: cs.messages.common.loading,
      }),
    ).toBeInTheDocument();
  });

  it("goes back through the router, or as onBack says", async () => {
    const user = userEvent.setup();
    const back = vi.fn();
    const { rerender } = render(
      <UIProvider router={{ back }}>
        <Header back title="Order 42" />
      </UIProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(back).toHaveBeenCalledOnce();

    const onBack = vi.fn();
    rerender(
      <UIProvider router={{ back }}>
        <Header back onBack={onBack} title="Order 42" />
      </UIProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(back).toHaveBeenCalledOnce();
  });
});
