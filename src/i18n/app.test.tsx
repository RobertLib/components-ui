import { render, screen } from "@testing-library/react";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import Breadcrumbs from "../components/ui/breadcrumbs";
import { useLocale, useMessages } from "../providers/ui-context";
import UIProvider from "../providers/ui-provider";
import { cs } from "./ui/cs";
import { en } from "./ui/en";
import { createLocale, formatMessage, formatPlural } from "./ui/format";
import type {
  DeepPartial,
  MessageCatalog,
  Messages,
  MessageShape,
  PluralMessage,
} from "./ui/types";

// Simulate the catalogs filled in by an application after copying src/.
const { appEn, appCs } = vi.hoisted(() => ({
  appEn: {
    common: { cancel: "Cancel invoice" },
    dashboard: {
      title: "Dashboard",
      welcome: "Hello, {name}!",
      invoices: { one: "{count} invoice", other: "{count} invoices" },
    },
  },
  appCs: {
    common: { cancel: "Stornovat fakturu" },
    dashboard: {
      title: "Přehled",
      welcome: "Ahoj, {name}!",
      invoices: {
        one: "{count} faktura",
        few: "{count} faktury",
        many: "{count} faktury",
        other: "{count} faktur",
      },
    },
  },
}));

vi.mock("./en", () => ({ default: appEn }));
vi.mock("./cs", () => ({ default: appCs }));

type TestMessages = MessageShape<typeof appEn>;

function Dashboard({ count = 3 }: { count?: number }) {
  // Only the runtime module is mocked; the shipped catalog's type is empty.
  const messages = useMessages() as TestMessages & Pick<Messages, "ui">;
  const { code } = useLocale();

  return (
    <>
      <h1>{messages.dashboard.title}</h1>
      <p>{formatMessage(messages.dashboard.welcome, { name: "Jana" })}</p>
      <p>{formatPlural(code, messages.dashboard.invoices, count)}</p>
      <p>{messages.common.cancel}</p>
      <p>{messages.ui.common.cancel}</p>
      <Breadcrumbs items={[{ label: messages.dashboard.title }]} />
    </>
  );
}

describe("application localization", () => {
  it("infers nested keys and allows each language's plural categories", () => {
    expectTypeOf<TestMessages>().toEqualTypeOf<{
      common: { cancel: string };
      dashboard: { title: string; welcome: string; invoices: PluralMessage };
    }>();
    expectTypeOf<typeof appCs>().toExtend<TestMessages>();
    expectTypeOf<
      MessageShape<{ other: "Other actions"; label: "Actions" }>
    >().toEqualTypeOf<{ other: string; label: string }>();
    expectTypeOf<{
      dashboard: { title: string };
    }>().not.toExtend<TestMessages>();
    expectTypeOf<{ invalid: number }>().not.toExtend<MessageCatalog>();
  });

  it("switches application and UI texts together, with English by default", () => {
    const { rerender } = render(<Dashboard />);
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    expect(screen.getByText("Hello, Jana!")).toBeVisible();
    expect(screen.getByText("3 invoices")).toBeVisible();
    expect(screen.getByRole("link", { name: "Home" })).toBeVisible();
    expect(screen.getByText("Cancel invoice")).toBeVisible();
    expect(screen.getByText("Cancel")).toBeVisible();
    expect(en.messages).not.toHaveProperty("app");

    rerender(
      <UIProvider locale={cs}>
        <Dashboard />
      </UIProvider>,
    );
    expect(screen.getByRole("heading", { name: "Přehled" })).toBeVisible();
    expect(screen.getByText("Ahoj, Jana!")).toBeVisible();
    expect(screen.getByText("3 faktury")).toBeVisible();
    expect(screen.getByRole("link", { name: "Domů" })).toBeVisible();
    expect(screen.getByText("Stornovat fakturu")).toBeVisible();
    expect(screen.getByText("Zrušit")).toBeVisible();

    rerender(
      <UIProvider locale={en}>
        <Dashboard />
      </UIProvider>,
    );
    expect(screen.getByText("3 invoices")).toBeVisible();
    expect(screen.getByRole("link", { name: "Home" })).toBeVisible();
  });

  it("inherits app texts and deeply overrides them in nested providers", () => {
    const overrides: DeepPartial<Messages & TestMessages> = {
      dashboard: { title: "Moje faktury" },
      ui: { breadcrumbs: { home: "Úvod" } },
    };
    render(
      <UIProvider locale={cs}>
        <UIProvider messages={overrides}>
          <Dashboard count={1.5} />
        </UIProvider>
      </UIProvider>,
    );
    expect(screen.getByRole("heading", { name: "Moje faktury" })).toBeVisible();
    expect(screen.getByText("Ahoj, Jana!")).toBeVisible();
    expect(screen.getByText("1,5 faktury")).toBeVisible();
    expect(screen.getByRole("link", { name: "Úvod" })).toBeVisible();
    expect(cs.messages).toMatchObject(appCs);
  });

  it("keeps app keys and fallback texts when deriving a custom locale", () => {
    const base = {
      ...en,
      messages: { ...(appEn as TestMessages), ui: en.messages.ui },
    };
    const overrides: DeepPartial<Messages & TestMessages> = {
      dashboard: {
        title: "Übersicht",
        invoices: { other: "Rechnungen: {count}" },
      },
      ui: { common: { cancel: "Abbrechen" } },
    };
    const de = createLocale(base, {
      code: "de-DE",
      messages: overrides,
    });
    render(
      <UIProvider locale={de}>
        <Dashboard count={1} />
      </UIProvider>,
    );
    expect(screen.getByRole("heading", { name: "Übersicht" })).toBeVisible();
    expect(screen.getByText("Hello, Jana!")).toBeVisible();
    expect(screen.getByText("Rechnungen: 1")).toBeVisible();
    expect(screen.getByText("Abbrechen")).toBeVisible();
    expect(screen.getByText("Cancel invoice")).toBeVisible();
    const messages = de.messages as Messages & TestMessages;
    expect(messages.dashboard.invoices).toEqual({
      other: "Rechnungen: {count}",
    });
    expect(en.messages).toMatchObject(appEn);
  });
});
