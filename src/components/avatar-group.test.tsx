import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import Avatar from "./avatar";
import AvatarGroup from "./avatar-group";
import UIProvider from "../providers/ui-provider";
import { cs } from "../i18n/cs";

const people = [
  "Jana Nováková",
  "Petr Svoboda",
  "Eva Malá",
  "Karel Dvořák",
  "Lucie Černá",
];

const avatars = people.map((name) => <Avatar key={name} name={name} />);

describe("AvatarGroup", () => {
  it("shows all avatars without max", () => {
    render(<AvatarGroup aria-label="Assignees">{avatars}</AvatarGroup>);

    const group = screen.getByRole("group", { name: "Assignees" });
    expect(within(group).getAllByRole("img")).toHaveLength(5);
    expect(within(group).queryByRole("button")).toBeNull();
  });

  it("counts the rest in the last place - never a single one", () => {
    const { rerender } = render(<AvatarGroup max={3}>{avatars}</AvatarGroup>);

    expect(screen.getAllByRole("img").map((img) => img.textContent)).toEqual([
      "JN",
      "PS",
    ]);
    expect(screen.getByRole("button", { name: "+3 more" })).toHaveTextContent(
      "+3",
    );

    // Room for all five - no "+1" in place of the fifth
    rerender(<AvatarGroup max={5}>{avatars}</AvatarGroup>);
    expect(screen.getAllByRole("img")).toHaveLength(5);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("lists the names of the rest in a tooltip", async () => {
    const user = userEvent.setup();
    render(<AvatarGroup max={3}>{avatars}</AvatarGroup>);

    await user.tab();
    const button = screen.getByRole("button", { name: "+3 more" });
    expect(button).toHaveFocus();
    // Shown at once on keyboard focus, and read as the description
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Eva Malá, Karel Dvořák, Lucie Černá",
    );
    expect(button).toHaveAccessibleDescription(
      "Eva Malá, Karel Dvořák, Lucie Černá",
    );
  });

  it("counts people it has no avatars of", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <AvatarGroup max={4} total={24}>
        {avatars.slice(0, 3)}
      </AvatarGroup>,
    );

    // No names to list - the rest is an image of its count
    expect(screen.getAllByRole("img").map((img) => img.textContent)).toEqual([
      "JN",
      "PS",
      "EM",
      "+21",
    ]);
    expect(screen.getByRole("img", { name: "+21 more" })).toBeInTheDocument();

    rerender(
      <AvatarGroup max={3} total={24}>
        {avatars.slice(0, 3)}
      </AvatarGroup>,
    );
    await user.tab();
    expect(screen.getByRole("button", { name: "+22 more" })).toHaveFocus();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Eva Malá, +21 more");
  });

  it("counts everybody it shows no avatar of - also below max", () => {
    render(
      <AvatarGroup max={10} total={24}>
        {avatars.slice(0, 3)}
      </AvatarGroup>,
    );

    expect(screen.getAllByRole("img")).toHaveLength(4);
    expect(screen.getByRole("img", { name: "+21 more" })).toBeInTheDocument();
  });

  it("gives its size to the avatars without one of their own", () => {
    render(
      <AvatarGroup max={3} size="lg">
        <Avatar name="Jana Nováková" />
        <Avatar name="Petr Svoboda" size="sm" />
        <Avatar name="Eva Malá" />
        <Avatar name="Karel Dvořák" />
      </AvatarGroup>,
    );

    const [jana, petr] = screen.getAllByRole("img");
    expect(jana).toHaveClass("h-12", "ring-2");
    expect(petr).toHaveClass("h-6");
    expect(screen.getByRole("button")).toHaveClass("h-12", "min-w-12");
  });

  it("counts in the language of the page", () => {
    render(
      <UIProvider locale={cs}>
        <AvatarGroup max={2}>{avatars}</AvatarGroup>
        <AvatarGroup max={1} total={1500}>
          {avatars.slice(0, 1)}
        </AvatarGroup>
      </UIProvider>,
    );

    expect(
      screen.getByRole("button", { name: "+4 další" }),
    ).toBeInTheDocument();
    // "1 500" with a non-breaking space
    expect(
      screen.getByRole("button", { name: "+1\u00a0500 dalších" }).textContent,
    ).toBe("+1\u00a0500");
  });
});
