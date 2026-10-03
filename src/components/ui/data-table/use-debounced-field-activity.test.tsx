import { act, fireEvent, render, screen } from "@testing-library/react";
import { Activity, StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import useDebouncedField from "./use-debounced-field";

function Field({
  onCommit,
  value,
}: {
  onCommit: (value: string) => void;
  value: string;
}) {
  const field = useDebouncedField(value, onCommit);
  return (
    <input
      aria-label="Filter"
      onChange={(event) => field.change(event.target.value)}
      value={field.value}
    />
  );
}

describe("useDebouncedField with Activity", () => {
  afterEach(() => vi.useRealTimers());

  it.each(["unchanged", "while hidden", "after showing"] as const)(
    "discards a canceled draft and follows the owner %s",
    (change) => {
      vi.useFakeTimers();
      const onCommit = vi.fn();
      const content = (mode: "hidden" | "visible", value: string) => (
        <StrictMode>
          <Activity mode={mode}>
            <Field onCommit={onCommit} value={value} />
          </Activity>
        </StrictMode>
      );
      const { rerender } = render(content("visible", "original"));
      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "draft" },
      });
      rerender(content("hidden", "original"));
      act(() => vi.advanceTimersByTime(500));
      expect(onCommit).not.toHaveBeenCalled();

      if (change === "while hidden") {
        rerender(content("hidden", "external"));
      }
      rerender(
        content("visible", change === "while hidden" ? "external" : "original"),
      );
      if (change === "after showing") {
        rerender(content("visible", "external"));
      }
      expect(screen.getByRole("textbox")).toHaveValue(
        change === "unchanged" ? "original" : "external",
      );

      fireEvent.change(screen.getByRole("textbox"), {
        target: { value: "next" },
      });
      act(() => vi.advanceTimersByTime(300));
      expect(onCommit).toHaveBeenCalledExactlyOnceWith("next");
    },
  );

  it("keeps a committed value while its owner is catching up", () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const content = (mode: "hidden" | "visible", value: string) => (
      <Activity mode={mode}>
        <Field onCommit={onCommit} value={value} />
      </Activity>
    );
    const { rerender } = render(content("visible", "original"));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "committed" },
    });
    act(() => vi.advanceTimersByTime(300));
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("committed");

    rerender(content("hidden", "original"));
    rerender(content("visible", "original"));
    expect(screen.getByRole("textbox")).toHaveValue("committed");
    rerender(content("visible", "committed"));
    rerender(content("visible", "external"));
    expect(screen.getByRole("textbox")).toHaveValue("external");
  });

  it("discards a newer draft without losing an earlier pending commit", () => {
    vi.useFakeTimers();
    const onCommit = vi.fn();
    const content = (mode: "hidden" | "visible", value: string) => (
      <Activity mode={mode}>
        <Field onCommit={onCommit} value={value} />
      </Activity>
    );
    const { rerender } = render(content("visible", "original"));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "committed" },
    });
    act(() => vi.advanceTimersByTime(300));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "draft" },
    });

    rerender(content("hidden", "original"));
    act(() => vi.advanceTimersByTime(500));
    rerender(content("visible", "original"));
    expect(screen.getByRole("textbox")).toHaveValue("committed");
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("committed");
    rerender(content("visible", "committed"));
    expect(screen.getByRole("textbox")).toHaveValue("committed");
  });
});
