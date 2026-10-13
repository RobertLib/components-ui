import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import Button from "./button";
import Dropdown from "./dropdown";

it("closes a portaled menu when its trigger's fieldset becomes disabled", async () => {
  const user = userEvent.setup();
  const action = vi.fn();
  const onOpenChange = vi.fn();
  const { container } = render(
    <fieldset>
      <Dropdown
        buttonTrigger
        items={[{ label: "Delete", onClick: action }]}
        onOpenChange={onOpenChange}
        trigger={<Button>Actions</Button>}
      />
    </fieldset>,
  );
  const trigger = screen.getByRole("button", { name: "Actions" });
  await user.click(trigger);
  expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();

  act(() => {
    container.querySelector("fieldset")!.disabled = true;
  });
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  expect(trigger).toBeDisabled();
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
  expect(action).not.toHaveBeenCalled();

  act(() => {
    container.querySelector("fieldset")!.disabled = false;
  });
  await waitFor(() => expect(trigger).toBeEnabled());
  expect(screen.queryByRole("menu")).toBeNull();
  await user.click(trigger);
  await user.click(screen.getByRole("menuitem", { name: "Delete" }));
  expect(action).toHaveBeenCalledTimes(1);
});

it("keeps a menu usable in the first legend of a disabled fieldset", async () => {
  const user = userEvent.setup();
  const action = vi.fn();
  const { container } = render(
    <fieldset>
      <legend>
        <Dropdown
          buttonTrigger
          items={[{ label: "Delete", onClick: action }]}
          trigger={<Button>Actions</Button>}
        />
      </legend>
    </fieldset>,
  );
  await user.click(screen.getByRole("button", { name: "Actions" }));
  await act(async () => {
    container.querySelector("fieldset")!.disabled = true;
  });
  expect(screen.getByRole("button", { name: "Actions" })).toBeEnabled();
  await user.click(screen.getByRole("menuitem", { name: "Delete" }));
  expect(action).toHaveBeenCalledTimes(1);
});
