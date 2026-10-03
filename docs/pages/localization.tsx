import { en } from "components-ui";
import CodeBlock from "../components/code-block";
import DocPage, { Callout, Prose, Section } from "../components/doc-page";
import Example from "../components/example";
import PropsTable from "../components/props-table";

const builtIn = `import { cs, UIProvider } from "components-ui";

<UIProvider locale={cs}>
  <App />
</UIProvider>`;

const overrideTexts = `// Change a few texts, keep the rest of the locale
<UIProvider
  locale={cs}
  messages={{
    ui: {
      dataTable: { noData: "Zatím tu nic není" },
      common: { confirm: "Ano" },
    },
  }}
>`;

const customLocale = `import { createLocale, en, type Locale } from "components-ui";

// British English - the built-in English with other formats
export const enGB = createLocale(en, {
  code: "en-GB",
  weekStartsOn: 1,
  formats: {
    date: "DD/MM/YYYY",
    dateTime: "DD/MM/YYYY HH:mm",
    month: "MM/YYYY",
    time: "HH:mm",
  },
});

// A new language - start from en and translate the messages
export const de: Locale = createLocale(en, {
  code: "de-DE",
  weekStartsOn: 1,
  formats: { date: "DD.MM.YYYY", dateTime: "DD.MM.YYYY HH:mm", month: "MM.YYYY", time: "HH:mm", week: "[KW] WW YYYY" },
  messages: {
    ui: {
      common: { cancel: "Abbrechen", close: "Schließen", confirm: "Bestätigen", delete: "Löschen" },
      // … the other UI groups, see the list below
    },
  },
});`;

const pluralExample = `// A text with plural forms - the right one is picked by Intl.PluralRules
selectedCount: {
  one: "Vybrána {count} položka",   // 1
  few: "Vybrány {count} položky",   // 2 - 4
  many: "Vybráno {count} položky",  // 1,5 - decimals
  other: "Vybráno {count} položek", // 0, 5+
},`;

const helpers = `import { formatMessage, formatPlural, useLocale } from "components-ui";

const { code, messages } = useLocale();
formatMessage("Hello {name}", { name: "Jana" });            // "Hello Jana"
formatPlural(code, messages.ui.dataTable.selectedCount, 3); // "Vybrány 3 položky"`;

const appEnglish = `// src/i18n/en.ts - the default catalog defines the keys and types
import type { MessageCatalog } from "./ui/types";

const en = {
  dashboard: {
    title: "Dashboard",
    welcome: "Hello, {name}!",
    invoices: {
      one: "{count} invoice",
      other: "{count} invoices",
    },
  },
} satisfies MessageCatalog;

export default en;`;

const appCzech = `// src/i18n/cs.ts - TypeScript checks the same keys
import type { AppMessages } from "./ui/types";

const cs: AppMessages = {
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
};

export default cs;`;

const appUsage = `// src/components/Dashboard.tsx - the same provider as the UI components
import {
  formatMessage, formatPlural, useLocale, useMessages,
} from "./ui";

export default function Dashboard() {
  const messages = useMessages();
  const { code } = useLocale();

  return (
    <section>
      <h1>{messages.dashboard.title}</h1>
      <p>{formatMessage(messages.dashboard.welcome, { name: "Jana" })}</p>
      <p>{formatPlural(code, messages.dashboard.invoices, 3)}</p>
    </section>
  );
}`;

const appProvider = `// src/App.tsx
import { cs, en, UIProvider } from "./components/ui";
import Dashboard from "./components/Dashboard";

const locales = { cs, en };

export default function App({ language }: { language: keyof typeof locales }) {
  return (
    <UIProvider locale={locales[language]}>
      <Dashboard />
      <YourRoutes />
    </UIProvider>
  );
}`;

const appFallback = `// src/i18n/cs.ts - optionally keep default texts until translated
import en from "./en";
import { deepMerge } from "./ui/format";
import type { AppMessages } from "./ui/types";

const cs: AppMessages = deepMerge<AppMessages>(en, {
  dashboard: { title: "Přehled" },
});

export default cs;`;

export default function Localization() {
  return (
    <DocPage
      description="UI components and your application share one locale in UIProvider. English (default) and Czech are built in; source copies include typed catalogs for your own texts."
      title="Localization"
    >
      <Section title="Choosing the language">
        <CodeBlock code={builtIn} />
        <Example
          collapsed
          description={
            <p>
              The same components in English, Czech and a custom German locale.
              A nested <code>UIProvider</code> changes only the language of its
              part of the page.
            </p>
          }
          name="localization/switcher"
          title="Switching the locale"
        />
      </Section>

      <Section title="Application texts in a source copy">
        <Prose>
          <p>
            After copying <code>src/</code>, add your own texts to{" "}
            <code>src/i18n/en.ts</code> and their Czech translations to{" "}
            <code>src/i18n/cs.ts</code>. Both start empty and are already
            connected to <code>useMessages()</code> at the root. UI texts stay
            in <code>src/i18n/ui/en.ts</code> and <code>src/i18n/ui/cs.ts</code>
            . Localization types and formatting helpers are in that UI folder
            too.
          </p>
          <p>
            Add strings, nested groups and plural messages to the default
            English catalog. <code>AppMessages</code> is inferred from it:
            autocomplete updates automatically, TypeScript reports missing
            translations or unknown keys, and each language chooses its own
            plural categories. You only edit the translation files.
          </p>
        </Prose>
        <CodeBlock code={appEnglish} />
        <CodeBlock className="mt-4" code={appCzech} />
        <Prose>
          <p>
            Read your texts with <code>useMessages()</code>, for example{" "}
            <code>useMessages().dashboard.title</code>. Library texts are in{" "}
            <code>useMessages().ui</code>, for example{" "}
            <code>useMessages().ui.common.cancel</code>. Use the same{" "}
            <code>formatMessage</code> and <code>formatPlural</code> helpers as
            the library. Local imports below work with the copied source.
          </p>
        </Prose>
        <CodeBlock code={appUsage} />
        <CodeBlock className="mt-4" code={appProvider} />
        <Prose>
          <p>
            Changing <code>locale</code> switches both the app and the UI
            components. Nested providers and the <code>messages</code> prop use
            the same shape: app keys at the root and library keys under{" "}
            <code>ui</code>. Without a provider, both use the default English
            locale.
          </p>
          <p>
            Complete catalogs catch forgotten translations when you add a key.
            To allow an incomplete translation instead, merge it with the
            default catalog; omitted texts use English:
          </p>
        </Prose>
        <CodeBlock code={appFallback} />
        <Prose>
          <p>
            For another language, add a catalog with type{" "}
            <code>AppMessages</code> and spread its texts into{" "}
            <code>messages</code> when creating its locale with{" "}
            <code>createLocale(en, ...)</code>. Translate library keys in{" "}
            <code>messages.ui</code>. Keep your application catalogs when
            updating <code>i18n/ui/</code> from the library.
          </p>
        </Prose>
      </Section>

      <Section title="What a locale contains">
        <PropsTable of="Locale" />
        <Prose>
          <ul>
            <li>
              <code>code</code> drives <code>Intl</code>: month and weekday
              names, the calendar header, AM / PM, plural rules and how counts
              are written (<code>12,345</code> / <code>12 345</code>). They need
              no translation. A code <code>Intl</code> does not understand (
              <code>en_GB</code> instead of <code>en-GB</code>) falls back to{" "}
              <code>en-US</code>, with a warning in the console. Calendars and
              date pickers use the Gregorian calendar for their values, month
              names and day labels, including in languages whose default
              calendar is different.
            </li>
            <li>
              <code>formats</code> are the display patterns of the pickers - the
              values stay in the ISO format of native inputs.
            </li>
            <li>
              <code>weekStartsOn</code> - 0 for Sunday (US), 1 for Monday (most
              of Europe).
            </li>
          </ul>
        </Prose>
        <PropsTable of="DateFormats" />
        <Callout>
          <p>
            Pattern tokens: <code>YYYY</code> year, <code>MM</code> /{" "}
            <code>M</code> month, <code>DD</code> / <code>D</code> day,{" "}
            <code>HH</code> / <code>H</code> hours, <code>hh</code> /{" "}
            <code>h</code> hours of the 12-hour clock with <code>A</code> for AM
            / PM (<code>en</code> uses <code>h:mm A</code>; AM / PM is written
            in the language of <code>code</code>, e.g. <code>dop.</code> /{" "}
            <code>odp.</code> in Czech), <code>mm</code> minutes,{" "}
            <code>WW</code> / <code>W</code> ISO week. Text in square brackets
            is printed as it is: <code>[W]WW.YYYY</code> → W39.2026 - the week
            picker labels its weeks with the week format without the year (W39).
            The user types dates in the same format - any separators and missing
            zeros are fine, a time without its minutes is the full hour, a
            format with <code>A</code> takes the AM / PM of the language and the
            English <code>am</code> / <code>pm</code> (a 24-hour format takes
            neither), and values pasted in ISO 8601 (<code>2026-09-24</code>)
            are read in every locale. The placeholders show the patterns without
            their bracketed text, with the tokens written by{" "}
            <code>messages.ui.dateTimePicker.placeholderTokens</code> -{" "}
            <code>{`{ YYYY: "RRRR" }`}</code> makes <code>DD.MM.YYYY</code> the
            Czech <code>DD.MM.RRRR</code>, <code>{`{ A: "AM/PM" }`}</code> the
            English <code>h:mm AM/PM</code>.
          </p>
        </Callout>
      </Section>

      <Section title="Changing texts">
        <CodeBlock code={overrideTexts} />
      </Section>

      <Section title="Your own locale">
        <Prose>
          <p>
            <code>createLocale(base, overrides)</code> deep-merges a locale -
            untranslated texts fall back to the base, also those a translation
            tool exports as <code>null</code>. A text with plural forms given
            with its <code>other</code> form replaces the base one as a whole,
            so no form of the base language is left in it (the same goes for the{" "}
            <code>messages</code> of <code>UIProvider</code>).
          </p>
        </Prose>
        <CodeBlock code={customLocale} />
        <Prose>
          <p>
            Punctuation is part of the locale too:{" "}
            <code>messages.ui.form.labelSuffix</code> follows every field label
            and <code>DescriptionList</code> term - <code>":"</code> in English
            and Czech, <code>" :"</code> in French, or <code>""</code> for
            labels without one.
          </p>
        </Prose>
      </Section>

      <Section title="Placeholders and plurals">
        <Prose>
          <p>
            Messages contain placeholders in curly braces (
            <code>{"{label}"}</code>, <code>{"{count}"}</code>) filled in by the
            component. Messages with a count have a form per plural category:
          </p>
        </Prose>
        <CodeBlock code={pluralExample} />
        <Prose>
          <p>
            The count is written as the language writes numbers (
            <code>12 345</code> in Czech). The helpers are exported for your own
            texts:
          </p>
        </Prose>
        <CodeBlock code={helpers} />
      </Section>

      <Section title="All texts">
        <Prose>
          <p>
            The English UI messages - the keys under <code>messages.ui</code>:
          </p>
        </Prose>
        <CodeBlock code={JSON.stringify(en.messages.ui, null, 2)} />
      </Section>
    </DocPage>
  );
}
