import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { cs } from "../i18n/cs";
import SplitButton from "./split-button";
import UIProvider from "../providers/ui-provider";

describe("SplitButton", () => {
  it("runs the main action and offers the others in a menu", async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    const saveDraft = vi.fn();
    render(
      <SplitButton
        items={[{ label: "Save as draft", onClick: saveDraft }]}
        onClick={save}
      >
        Save
      </SplitButton>,
    );

    // A group named by the main action
    expect(screen.getByRole("group", { name: "Save" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(save).toHaveBeenCalledTimes(1);

    const toggle = screen.getByRole("button", { name: "More options" });
    expect(toggle).toHaveAttribute("aria-haspopup", "menu");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("menuitem", { name: "Save as draft" }));
    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("opens the menu from the keyboard", async () => {
    const user = userEvent.setup();
    render(
      <SplitButton items={[{ label: "Save and close" }]}>Save</SplitButton>,
    );

    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "More options" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menu")).toHaveFocus();
  });

  it("names the toggle in the language of the app", () => {
    const { rerender } = render(
      <UIProvider locale={cs}>
        <SplitButton items={[]}>Uložit</SplitButton>
      </UIProvider>,
    );
    expect(
      screen.getByRole("button", { name: "Další možnosti" }),
    ).toBeInTheDocument();

    rerender(
      <SplitButton items={[]} toggleLabel="More ways to save">
        Save
      </SplitButton>,
    );
    expect(
      screen.getByRole("button", { name: "More ways to save" }),
    ).toBeInTheDocument();
  });

  it("is busy or disabled as a whole", () => {
    const { rerender } = render(
      <SplitButton items={[{ label: "Save as draft" }]} loading>
        Save
      </SplitButton>,
    );
    const save = screen.getByRole("button", { name: "Save" });
    // Busy, the pressed button keeps the focus - `aria-disabled`
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(save).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "More options" })).toBeDisabled();

    rerender(
      <SplitButton disabled items={[{ label: "Save as draft" }]}>
        Save
      </SplitButton>,
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "More options" })).toBeDisabled();
  });

  it("closes its menu as its action starts", async () => {
    const user = userEvent.setup();
    const menu = (loading: boolean) => (
      <SplitButton items={[{ label: "Save as draft" }]} loading={loading}>
        Save
      </SplitButton>
    );
    const { rerender } = render(menu(false));

    await user.click(screen.getByRole("button", { name: "More options" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    // E.g. a shortcut saves meanwhile - nothing of the menu is for now
    rerender(menu(true));
    await act(async () => {});
    expect(screen.queryByRole("menu")).toBeNull();
    // Not to the page, nor to the disabled toggle - to the busy main button
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
  });

  it("gives its look to both buttons and the other props to the main one", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <SplitButton
          className="mt-4"
          color="success"
          items={[{ label: "Save as draft" }]}
          name="intent"
          size="sm"
          type="submit"
          value="publish"
          variant="outline"
        >
          Publish
        </SplitButton>
      </form>,
    );

    expect(screen.getByRole("group")).toHaveClass("mt-4");
    const publish = screen.getByRole("button", { name: "Publish" });
    const toggle = screen.getByRole("button", { name: "More options" });
    for (const button of [publish, toggle]) {
      expect(button).toHaveClass("border-[1.5px]", "text-success-700");
    }
    expect(publish).toHaveClass("px-2", "rounded-s-md");
    expect(toggle).toHaveClass("px-1!", "rounded-e-md");

    await user.click(publish);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(toggle).toHaveAttribute("type", "button");
  });

  it("stretches the main button with fullWidth", () => {
    render(
      <SplitButton fullWidth items={[{ label: "Save as draft" }]}>
        Save
      </SplitButton>,
    );

    expect(screen.getByRole("group")).toHaveClass("w-full");
    expect(screen.getByRole("button", { name: "Save" })).toHaveClass("flex-1");
  });

  it("renders on the server", () => {
    const html = renderToString(
      <SplitButton items={[{ label: "Save as draft" }]}>Save</SplitButton>,
    );
    expect(html).toContain("Save");
    expect(html).toContain('aria-label="More options"');
  });
});
