import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import LoadingOverlay from "./loading-overlay";
import { cs } from "../i18n/cs";
import UIProvider from "../providers/ui-provider";

const overlayOf = (container: HTMLElement) =>
  container.querySelector<HTMLElement>("[data-loading-overlay]")!;

describe("LoadingOverlay", () => {
  it("covers the content while visible - inert and busy", () => {
    const { container, rerender } = render(
      <LoadingOverlay className="rounded-lg" data-testid="region">
        <button type="button">Save</button>
      </LoadingOverlay>,
    );
    const region = screen.getByTestId("region");
    const content = screen.getByRole("button", { name: "Save" }).parentElement!;
    expect(region).toHaveClass("relative", "rounded-lg");
    expect(region).not.toHaveAttribute("aria-busy");
    expect(content).not.toHaveAttribute("inert");
    expect(overlayOf(container)).toHaveClass("invisible", "opacity-0");

    rerender(
      <LoadingOverlay className="rounded-lg" data-testid="region" visible>
        <button type="button">Save</button>
      </LoadingOverlay>,
    );
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(content).toHaveAttribute("inert");
    const overlay = overlayOf(container);
    expect(overlay).toHaveClass(
      "visible",
      "opacity-100",
      "absolute",
      "inset-0",
    );
    // The layer is for the eye - the status speaks
    expect(overlay).toHaveAttribute("aria-hidden", "true");
  });

  it("fades in and out - at once for users who prefer reduced motion", () => {
    const { container } = render(
      <LoadingOverlay visible>Table</LoadingOverlay>,
    );

    expect(overlayOf(container)).toHaveClass(
      "transition-[opacity,visibility]",
      "motion-reduce:transition-none",
    );
  });

  it("tells screen readers of the loading once it shows", () => {
    const { rerender } = render(
      <LoadingOverlay label="Loading orders…">Table</LoadingOverlay>,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("");

    rerender(
      <LoadingOverlay label="Loading orders…" visible>
        Table
      </LoadingOverlay>,
    );
    expect(status).toHaveTextContent("Loading orders…");
    // Shown under the spinner too
    expect(screen.getAllByText("Loading orders…")).toHaveLength(2);

    rerender(
      <UIProvider locale={cs}>
        <LoadingOverlay visible>Table</LoadingOverlay>
      </UIProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Načítání…");
  });

  it("holds the focus of the covered content and gives it back", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <LoadingOverlay data-testid="region">
        <button type="button">Refresh</button>
      </LoadingOverlay>,
    );
    const button = screen.getByRole("button", { name: "Refresh" });
    await user.tab();
    expect(button).toHaveFocus();

    rerender(
      <LoadingOverlay data-testid="region" visible>
        <button type="button">Refresh</button>
      </LoadingOverlay>,
    );
    const region = screen.getByTestId("region");
    expect(region).toHaveFocus();
    expect(region).toHaveAttribute("tabindex", "-1");

    rerender(
      <LoadingOverlay data-testid="region">
        <button type="button">Refresh</button>
      </LoadingOverlay>,
    );
    expect(button).toHaveFocus();
    expect(region).not.toHaveAttribute("tabindex");
  });

  it("leaves a focus outside of it alone", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <>
        <button type="button">Outside</button>
        <LoadingOverlay>Table</LoadingOverlay>
      </>,
    );
    await user.tab();

    rerender(
      <>
        <button type="button">Outside</button>
        <LoadingOverlay visible>Table</LoadingOverlay>
      </>,
    );
    expect(screen.getByRole("button", { name: "Outside" })).toHaveFocus();
  });

  it("blurs the content on request", () => {
    const { container } = render(
      <LoadingOverlay blur overlayClassName="bg-black/40" visible>
        Table
      </LoadingOverlay>,
    );

    expect(overlayOf(container)).toHaveClass(
      "backdrop-blur-[2px]",
      "bg-black/40",
    );
  });
});
