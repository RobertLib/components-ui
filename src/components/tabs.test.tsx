import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import Tabs from "./tabs";
import UIProvider from "../providers/ui-provider";

describe("Tabs", () => {
  it("marks the most specific matching link as active", () => {
    render(
      <UIProvider router={{ pathname: "/users/archive", search: "" }}>
        <Tabs
          items={[
            { href: "/users", label: "All" },
            { href: "/users/archive", label: "Archive" },
          ]}
        />
      </UIProvider>,
    );

    expect(screen.getByRole("link", { name: "Archive" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "All" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});

describe("Tabs with values", () => {
  function Controlled() {
    const [value, setValue] = useState("week");

    return (
      <Tabs
        items={[
          { label: "Day", value: "day" },
          { label: "Week", value: "week" },
          { label: "Month", value: "month" },
        ]}
        onChange={setValue}
        value={value}
      />
    );
  }

  it("are one tab stop and switched with the arrow keys", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Controlled />
        <button type="button">After</button>
      </>,
    );

    await user.tab();
    expect(screen.getByRole("tab", { name: "Week" })).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    const month = screen.getByRole("tab", { name: "Month" });
    expect(month).toHaveFocus();
    expect(month).toHaveAttribute("aria-selected", "true");

    // Around the end, and Home / End
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Day" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(month).toHaveAttribute("aria-selected", "true");

    await user.tab();
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
  });
});
