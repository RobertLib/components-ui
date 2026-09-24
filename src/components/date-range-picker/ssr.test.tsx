import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import DateRangePicker from ".";
import { cs } from "../../i18n/cs";
import UIProvider from "../../providers/ui-provider";

describe("DateRangePicker on the server", () => {
  it("renders without the browser, then hydrates without a mismatch", async () => {
    const picker = (
      <UIProvider locale={cs}>
        <form>
          <DateRangePicker
            defaultValue={{ end: "2026-09-30", start: "2026-09-01" }}
            description="Nejvýše jeden rok"
            endName="to"
            error="Vyberte období"
            label="Období"
            maxDays={366}
            presets
            startName="from"
          />
        </form>
      </UIProvider>
    );

    // Nothing of the browser is touched while rendering
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);
    vi.stubGlobal("navigator", undefined);
    const html = renderToString(picker);
    vi.unstubAllGlobals();

    expect(html).toContain('value="01.09.2026 – 30.09.2026"');
    expect(html).toContain('name="from" value="2026-09-01"');
    expect(html).toContain("Nejvýše jeden rok");

    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const onRecoverableError = vi.fn();

    const root = await act(async () =>
      hydrateRoot(container, picker, { onRecoverableError }),
    );
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.querySelector("input[role=combobox]")).toHaveValue(
      "01.09.2026 – 30.09.2026",
    );

    act(() => root.unmount());
    container.remove();
  });
});
