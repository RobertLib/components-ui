import { act, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";
import Tooltip from "./tooltip";

it("measures an initially open tooltip once its portal hydrates", async () => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    bottom: 320,
    height: 20,
    left: 500,
    right: 540,
    top: 300,
    width: 40,
    x: 500,
    y: 300,
    toJSON: () => ({}),
  });
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(120);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(24);
  const page = (
    <Tooltip open position="top" title="Saves the draft">
      <button type="button">Save</button>
    </Tooltip>
  );
  const container = document.createElement("div");
  container.innerHTML = renderToString(page);
  document.body.append(container);
  const onRecoverableError = vi.fn();
  const root = await act(async () =>
    hydrateRoot(container, page, { onRecoverableError }),
  );

  try {
    expect(onRecoverableError).not.toHaveBeenCalled();
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveAttribute("data-side", "top");
    expect(tooltip.style.left).toBe("460px");
    expect(tooltip.style.top).toBe("268px");
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});
