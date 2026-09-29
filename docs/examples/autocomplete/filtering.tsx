import {
  Autocomplete,
  defaultFilterOptions,
  type AutocompleteOption,
} from "components-ui";

interface Currency {
  code: string;
  name: string;
}

const currencies: Currency[] = [
  { code: "CZK", name: "Czech koruna" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "Pound sterling" },
  { code: "CHF", name: "Swiss franc" },
  { code: "PLN", name: "Polish złoty" },
  { code: "HUF", name: "Hungarian forint" },
  { code: "USD", name: "United States dollar" },
];

// The label matches as by default - and the code does too, first
function filterCurrencies(options: AutocompleteOption[], search: string) {
  const term = search.toUpperCase();
  const byCode = options.filter((option) =>
    (option.data as Currency).code.startsWith(term),
  );
  const byName = defaultFilterOptions(options, search).filter(
    (option) => !byCode.includes(option),
  );
  return [...byCode, ...byName];
}

export default function Filtering() {
  return (
    <div className="max-w-sm">
      <Autocomplete
        description="Try “ch”, “usd” or “zloty”."
        filterOptions={filterCurrencies}
        getOptionLabel={(currency: Currency) =>
          `${currency.code} - ${currency.name}`
        }
        getOptionValue={(currency) => currency.code}
        highlightMatches
        label="Currency"
        options={currencies}
        placeholder="Code or name…"
      />
    </div>
  );
}
