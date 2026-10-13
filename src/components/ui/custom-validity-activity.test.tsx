import { act, render, screen, within } from "@testing-library/react";
import { Activity, StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import Input from "./input";
import NumberInput from "./number-input";
import TagsInput from "./tags-input";
import DateTimePicker from "./datetime-picker";
import PhoneInput from "./phone-input";
import CheckboxGroup from "./checkbox-group";
import RepeatableField from "./repeatable-field";
import TransferList from "./transfer-list";
import UIProvider from "../../providers/ui-provider";

const options = [
  { label: "First", value: "first" },
  { label: "Second", value: "second" },
];

const fields = [
  {
    name: "NumberInput",
    field: (valid: boolean) => <NumberInput max={5} value={valid ? 5 : 10} />,
  },
  {
    name: "TagsInput",
    field: (valid: boolean) => (
      <TagsInput required value={valid ? ["tag"] : []} />
    ),
  },
  {
    name: "masked Input",
    field: (valid: boolean) => (
      <Input mask="####" onChange={() => {}} value={valid ? "1234" : "12"} />
    ),
  },
  ...(["native", "custom"] as const).map((mode) => ({
    name: `${mode} DateTimePicker`,
    field: (valid: boolean) => (
      <DateTimePicker
        isDateDisabled={(date) => date.getDate() === 10}
        mode={mode}
        onChange={() => {}}
        value={valid ? "2026-09-11" : "2026-09-10"}
      />
    ),
  })),
  {
    name: "PhoneInput",
    field: (valid: boolean) => (
      <PhoneInput value={valid ? "+420777123456" : "+4201"} />
    ),
  },
  {
    name: "CheckboxGroup",
    field: (valid: boolean) => (
      <CheckboxGroup
        min={2}
        options={options}
        value={valid ? ["first", "second"] : ["first"]}
      />
    ),
  },
  {
    name: "RepeatableField",
    field: (valid: boolean) => (
      <RepeatableField
        createItem={() => ""}
        min={2}
        renderItem={({ value }) => <span>{value}</span>}
        value={
          valid
            ? [
                { id: "1", value: "a" },
                { id: "2", value: "b" },
              ]
            : [{ id: "1", value: "a" }]
        }
      />
    ),
  },
  {
    name: "TransferList",
    field: (valid: boolean) => (
      <TransferList
        min={2}
        options={options}
        value={valid ? ["first", "second"] : ["first"]}
      />
    ),
  },
];

describe.each(fields)("Initially hidden $name validation", ({ field }) => {
  it("blocks submission and follows corrected values before first reveal", async () => {
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const view = (valid: boolean) => (
      <StrictMode>
        <form aria-label="Edit" onSubmit={submit}>
          <Activity mode="hidden">{field(valid)}</Activity>
        </form>
      </StrictMode>
    );
    const { rerender } = render(view(false));
    await act(async () => {});
    const form = screen.getByRole<HTMLFormElement>("form");
    expect(form.elements.length).toBeGreaterThan(0);
    expect(form.checkValidity()).toBe(false);
    act(() => form.requestSubmit());
    expect(submit).not.toHaveBeenCalled();

    await act(async () => rerender(view(true)));
    expect(form.checkValidity()).toBe(true);
    act(() => form.requestSubmit());
    expect(submit).toHaveBeenCalledTimes(1);
    await act(async () => rerender(view(false)));
    expect(form.checkValidity()).toBe(false);
  });
});

it("validates initially hidden fields in a configured shadow root", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const shadow = host.attachShadow({ mode: "open" });
  const container = document.createElement("div");
  const portal = document.createElement("div");
  shadow.append(container, portal);
  const view = (value: number) => (
    <UIProvider portalContainer={portal}>
      <form aria-label="Edit">
        <Activity mode="hidden">
          <NumberInput max={5} value={value} />
        </Activity>
      </form>
    </UIProvider>
  );
  const { rerender, unmount } = render(view(10), { container });
  try {
    await act(async () => {});
    const form = within(container).getByRole<HTMLFormElement>("form");
    expect(form.checkValidity()).toBe(false);
    await act(async () => rerender(view(5)));
    expect(form.checkValidity()).toBe(true);
  } finally {
    unmount();
    host.remove();
  }
});

it("preserves an application error and restores its method after hidden unmount", async () => {
  const view = (value: number, mounted = true) => (
    <form aria-label="Edit">
      <Activity mode="hidden">
        {mounted && <NumberInput max={5} value={value} />}
      </Activity>
    </form>
  );
  const { rerender } = render(view(10));
  await act(async () => {});
  const form = screen.getByRole<HTMLFormElement>("form");
  const input = form.querySelector<HTMLInputElement>('input[type="text"]')!;
  input.setCustomValidity("Server error");
  await act(async () => rerender(view(5)));
  expect(input.validationMessage).toBe("Server error");
  await act(async () => rerender(view(5, false)));
  expect(Object.hasOwn(input, "setCustomValidity")).toBe(false);
  expect(input.validationMessage).toBe("Server error");
});

it("finds its own shadow field when overlays target another root with the same public id", async () => {
  const hosts = [document.createElement("div"), document.createElement("div")];
  document.body.append(...hosts);
  const roots = hosts.map((host) => host.attachShadow({ mode: "open" }));
  const containers = roots.map((root) => {
    const container = document.createElement("div");
    root.append(container);
    return container;
  });
  const other = render(
    <form>
      <NumberInput id="shared" max={5} value={1} />
    </form>,
    { container: containers[1] },
  );
  const own = render(
    <UIProvider portalContainer={containers[1]}>
      <form>
        <Activity mode="hidden">
          <NumberInput id="shared" max={5} value={10} />
        </Activity>
      </form>
    </UIProvider>,
    { container: containers[0] },
  );
  try {
    await act(async () => {});
    expect(containers[0].querySelector("form")!.checkValidity()).toBe(false);
    expect(containers[1].querySelector("form")!.checkValidity()).toBe(true);
  } finally {
    own.unmount();
    other.unmount();
    hosts.forEach((host) => host.remove());
  }
});
