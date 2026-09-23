import { useState } from "react";
import {
  Autocomplete,
  cs,
  createLocale,
  DateTimePicker,
  en,
  Pagination,
  Tabs,
  UIProvider,
} from "components-ui";

// A locale of your own: the built-in English with German formats and a few
// texts - untranslated texts fall back to English, month and weekday names
// come from Intl
const de = createLocale(en, {
  code: "de-DE",
  formats: {
    date: "DD.MM.YYYY",
    dateTime: "DD.MM.YYYY HH:mm",
    month: "MM.YYYY",
    week: "[KW] WW YYYY",
  },
  messages: {
    autocomplete: { noResults: "Keine Ergebnisse" },
    pagination: { range: "{from}–{to} von {total}" },
  },
  weekStartsOn: 1,
});

const locales = { cs, de, en };

export default function Switcher() {
  const [name, setName] = useState<keyof typeof locales>("cs");

  return (
    <div className="space-y-5">
      <Tabs
        items={[
          { label: "English", value: "en" },
          { label: "Čeština", value: "cs" },
          { label: "Deutsch (custom)", value: "de" },
        ]}
        onChange={(value) => setName(value as keyof typeof locales)}
        value={name}
      />
      <UIProvider locale={locales[name]}>
        <div className="grid gap-5 sm:grid-cols-2">
          <DateTimePicker defaultValue="2026-09-24" label="Date" type="date" />
          <DateTimePicker defaultValue="2026-W39" label="Week" type="week" />
          <Autocomplete
            label="Type something unknown"
            options={[{ label: "Praha", value: "praha" }]}
          />
          <div className="self-end">
            <Pagination
              currentPage={2}
              onChange={() => {}}
              pageSize={20}
              total={135}
            />
          </div>
        </div>
      </UIProvider>
    </div>
  );
}
