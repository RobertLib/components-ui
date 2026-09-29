import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Switch from "./switch";

const trackOf = (element: HTMLElement) =>
  element.closest("label")!.querySelector("[aria-hidden='true']");

describe("Switch", () => {
  it("sizes the track by dim - md by default", () => {
    render(
      <>
        <Switch dim="xs" label="Extra small" />
        <Switch label="Medium" />
        <Switch dim="lg" label="Large" />
      </>,
    );

    expect(
      trackOf(screen.getByRole("switch", { name: /Extra small/ })),
    ).toHaveClass("h-3.5", "w-6", "after:size-2.5");
    expect(trackOf(screen.getByRole("switch", { name: /Medium/ }))).toHaveClass(
      "h-5",
      "w-9",
      "after:size-4",
    );
    expect(trackOf(screen.getByRole("switch", { name: /Large/ }))).toHaveClass(
      "h-6",
      "w-11",
      "after:size-5",
    );
    expect(screen.getByText("Large")).toHaveClass("text-base");
  });

  it("puts the label before the track with labelPosition start", () => {
    render(
      <>
        <Switch description="Once a day" label="Digest" labelPosition="start" />
        <Switch description="At once" label="Alerts" />
      </>,
    );

    const digest = screen.getByRole("switch", { name: /Digest/ });
    const text = screen.getByText("Digest");
    const track = trackOf(digest)!;
    expect(
      text.compareDocumentPosition(track) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(text).toHaveClass("me-3");
    expect(digest).toHaveAccessibleName("Digest");
    // Under the label at the start - no room kept for the track before it
    expect(screen.getByText("Once a day")).not.toHaveClass("ms-12");

    const alerts = screen.getByText("Alerts");
    expect(
      alerts.compareDocumentPosition(trackOf(alerts)!) &
        Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy();
    expect(screen.getByText("At once")).toHaveClass("ms-12");
  });

  it("does not change while read-only, but is focusable and submitted", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <form aria-label="Settings">
        <Switch
          defaultChecked
          label="Sync"
          name="sync"
          onChange={onChange}
          readOnly
        />
      </form>,
    );

    const toggle = screen.getByRole("switch", { name: /Sync/ });
    await user.click(toggle);
    expect(toggle).toBeChecked();
    expect(toggle).toHaveFocus();
    await user.keyboard(" ");
    expect(toggle).toBeChecked();
    await user.click(screen.getByText("Sync"));
    expect(toggle).toBeChecked();

    expect(onChange).not.toHaveBeenCalled();
    expect(toggle).toHaveAttribute("aria-readonly", "true");
    expect(
      new FormData(screen.getByRole<HTMLFormElement>("form")).get("sync"),
    ).toBe("on");
  });

  it("is not validated while read-only", () => {
    render(
      <form aria-label="Settings">
        <Switch label="Required" readOnly required />
      </form>,
    );

    expect(screen.getByRole<HTMLInputElement>("switch").required).toBe(false);
    expect(screen.getByRole<HTMLFormElement>("form").checkValidity()).toBe(
      true,
    );
  });
});
