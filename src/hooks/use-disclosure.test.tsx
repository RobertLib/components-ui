import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import Dialog from "../components/dialog";
import useDisclosure from "./use-disclosure";

describe("useDisclosure", () => {
  it("opens, closes, toggles and sets the state", () => {
    const { result } = renderHook(() => useDisclosure());
    expect(result.current.open).toBe(false);

    act(() => result.current.onOpen());
    expect(result.current.open).toBe(true);

    act(() => result.current.onClose());
    expect(result.current.open).toBe(false);

    act(() => result.current.onToggle());
    expect(result.current.open).toBe(true);
    act(() => result.current.onToggle());
    expect(result.current.open).toBe(false);

    act(() => result.current.onOpenChange(true));
    expect(result.current.open).toBe(true);
  });

  it("starts open with initialOpen", () => {
    const { result } = renderHook(() => useDisclosure(true));
    expect(result.current.open).toBe(true);
  });

  it("fits the props of Dialog", async () => {
    const user = userEvent.setup();

    function Page() {
      const dialog = useDisclosure();
      return (
        <>
          <button onClick={dialog.onOpen}>Edit</button>
          <Dialog onClose={dialog.onClose} open={dialog.open} title="Edit">
            <input aria-label="Name" />
          </Dialog>
        </>
      );
    }

    render(<Page />);
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("dialog", { name: "Edit" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
