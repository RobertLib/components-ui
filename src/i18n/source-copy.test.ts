// @vitest-environment node
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { expect, it } from "vitest";

it("types application catalogs and the public API after copying src", () => {
  const sourceRoot = fileURLToPath(new URL("../", import.meta.url));
  // Replace the empty starter catalogs only in the compiler's file system.
  // This exercises the actual imports and inferred types, without mocks or
  // changing the user's translation files on disk.
  const files = new Map([
    [
      `${sourceRoot}i18n/en.ts`,
      `import type { MessageCatalog } from "./ui/types";
const en = {
  common: { cancel: "Cancel invoice" },
  dashboard: {
    title: "Dashboard",
    welcome: "Hello, {name}!",
    invoices: { one: "{count} invoice", other: "{count} invoices" },
  },
} satisfies MessageCatalog;
export default en;`,
    ],
    [
      `${sourceRoot}i18n/cs.ts`,
      `import type { AppMessages } from "./ui/types";
const cs: AppMessages = {
  common: { cancel: "Stornovat fakturu" },
  dashboard: {
    title: "Přehled",
    welcome: "Ahoj, {name}!",
    invoices: {
      one: "{count} faktura", few: "{count} faktury",
      many: "{count} faktury", other: "{count} faktur",
    },
  },
};
export default cs;`,
    ],
    [
      `${sourceRoot}localization-consumer.tsx`,
      `import {
  UIProvider, useMessages, useLocale, en, cs, createLocale,
  formatMessage, formatPlural, type AppMessages,
} from "./components/ui";

const base = {
  ...en,
  messages: {
    ...en.messages,
    dashboard: {
      ...en.messages.dashboard,
      invoices: { one: "{count} invoice", other: "{count} invoices" },
    },
  },
};
const de = createLocale(base, {
  code: "de-DE",
  messages: {
    dashboard: { title: "Übersicht", invoices: { other: "Rechnungen: {count}" } },
    ui: { common: { cancel: "Abbrechen" } },
  },
});
const title: string = de.messages.dashboard.title;
// Plural replacement can remove the default language's other categories.
// @ts-expect-error a locale need not have the "one" category
const removedPluralForm: string = de.messages.dashboard.invoices.one;
// @ts-expect-error missing the dashboard group's translations
const incomplete: AppMessages = { common: { cancel: "Cancel" } };

function Dashboard() {
  const messages = useMessages();
  const { code } = useLocale();
  const appCancel: string = messages.common.cancel;
  const uiCancel: string = messages.ui.common.cancel;
  const welcome = formatMessage(messages.dashboard.welcome, { name: "Jana" });
  const invoices = formatPlural(code, messages.dashboard.invoices, 3);
  // @ts-expect-error application keys are at the root
  messages.app;
  // @ts-expect-error unknown application keys are rejected
  messages.dashboard.unknown;
  // @ts-expect-error unknown UI keys are rejected
  messages.ui.common.unknown;
  return <p>{title}{messages.dashboard.title}{appCancel}{uiCancel}{welcome}{invoices}</p>;
}

export const app = <UIProvider locale={cs} messages={{
  dashboard: { title: "Moje faktury" },
  ui: { common: { cancel: "Zavřít" } },
}}><Dashboard /></UIProvider>;`,
    ],
  ]);

  const options: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2023,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    lib: ["lib.es2023.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
    types: ["react", "react-dom"],
  };
  const host = ts.createCompilerHost(options);
  const { fileExists, readFile, getSourceFile } = host;
  host.fileExists = (path) => files.has(path) || fileExists(path);
  host.readFile = (path) => files.get(path) ?? readFile(path);
  host.getSourceFile = (path, languageVersion, onError, shouldCreateNew) => {
    const content = files.get(path);
    return content === undefined
      ? getSourceFile(path, languageVersion, onError, shouldCreateNew)
      : ts.createSourceFile(path, content, languageVersion, true);
  };

  const program = ts.createProgram(
    [`${sourceRoot}localization-consumer.tsx`],
    options,
    host,
  );
  const errors = ts.getPreEmitDiagnostics(program).map((diagnostic) => ({
    file: diagnostic.file?.fileName,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
  }));
  expect(errors).toEqual([]);
}, 30_000);
