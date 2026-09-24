import { useState } from "react";
import { Button, Checkbox, Splitter } from "components-ui";

export default function Controlled() {
  const [sizes, setSizes] = useState([25, 75]);
  const filtersShown = sizes[0] > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => setSizes(filtersShown ? [0, 100] : [25, 75])}
          size="sm"
          variant="outline"
        >
          {filtersShown ? "Hide filters" : "Show filters"}
        </Button>
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          Sizes: {sizes.map((size) => `${Math.round(size)} %`).join(" / ")}
        </span>
      </div>
      <Splitter
        className="h-[260px] rounded-lg border border-neutral-200 dark:border-neutral-800"
        collapsible={[true, false]}
        minSizes={[15, 40]}
        onSizesChange={setSizes}
        paneLabels={["Filters"]}
        sizes={sizes}
      >
        <div className="space-y-2 p-4">
          <Checkbox defaultChecked label="Paid" />
          <Checkbox label="Overdue" />
          <Checkbox label="Draft" />
        </div>
        <p className="p-4 text-sm text-neutral-600 dark:text-neutral-400">
          24 invoices match the filters.
        </p>
      </Splitter>
    </div>
  );
}
