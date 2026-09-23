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
    dataTable: { noData: "Zatím tu nic není" },
    common: { confirm: "Ano" },
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
    common: { cancel: "Abbrechen", close: "Schließen", confirm: "Bestätigen", delete: "Löschen" },
    // … the other groups, see the list below
  },
});`;

const pluralExample = `// A text with plural forms - the right one is picked by Intl.PluralRules
selectedCount: {
  one: "Vybrána {count} položka",   // 1
  few: "Vybrány {count} položky",   // 2 - 4
  other: "Vybráno {count} položek", // 0, 5+
},`;

const helpers = `import { formatMessage, formatPlural, useLocale } from "components-ui";

const { code, messages } = useLocale();
formatMessage("Hello {name}", { name: "Jana" });            // "Hello Jana"
formatPlural(code, messages.dataTable.selectedCount, 3);    // "Vybrány 3 položky"`;

export default function Localization() {
  return (
    <DocPage
      description="Every text, date format and the first day of the week come from the locale in UIProvider. English (default) and Czech are built in; any other language is a locale object."
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

      <Section title="What a locale contains">
        <PropsTable of="Locale" />
        <Prose>
          <ul>
            <li>
              <code>code</code> drives <code>Intl</code>: month and weekday
              names, the calendar header, plural rules. They need no
              translation.
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
            / PM (<code>en</code> uses <code>h:mm A</code>), <code>mm</code>{" "}
            minutes, <code>WW</code> / <code>W</code> ISO week. Text in square
            brackets is printed as it is: <code>[W]WW.YYYY</code> → W39.2026.
            The user types dates in the same format - any separators and missing
            zeros are fine.
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
            untranslated texts fall back to the base.
          </p>
        </Prose>
        <CodeBlock code={customLocale} />
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
          <p>The helpers are exported for your own texts:</p>
        </Prose>
        <CodeBlock code={helpers} />
      </Section>

      <Section title="All texts">
        <Prose>
          <p>
            The English messages - the complete list of keys a locale defines:
          </p>
        </Prose>
        <CodeBlock code={JSON.stringify(en.messages, null, 2)} />
      </Section>
    </DocPage>
  );
}
