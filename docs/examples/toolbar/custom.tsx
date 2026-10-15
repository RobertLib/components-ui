import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { Input, Toolbar, useSnackbar } from "components-ui";

const views = [
  { label: "Table", value: "table" },
  { label: "Board", value: "board" },
  { label: "Calendar", value: "calendar" },
];

export default function Custom() {
  const { enqueueSnackbar } = useSnackbar();
  const [query, setQuery] = useState("");
  const [view, setView] = useState("table");

  return (
    <div className="w-150 max-w-full min-w-24 resize-x overflow-hidden rounded-md border border-dashed border-neutral-300 p-2 dark:border-neutral-700">
      <Toolbar
        aria-label="Orders"
        items={[
          {
            id: "search",
            // Spread the props on the control - the arrow keys reach it,
            // and leave it the caret
            render: (props) => (
              <div className="w-56">
                <Input
                  {...props}
                  aria-label="Search orders"
                  dim="sm"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search orders…"
                  prefix={<Search size={14} />}
                  type="search"
                  value={query}
                />
              </div>
            ),
            // No menu item - it stays in the bar
            type: "custom",
          },
          { type: "separator" },
          {
            id: "view",
            // In the menu as radio options
            menuItem: {
              label: "View",
              onChange: setView,
              options: views,
              type: "radio",
              value: view,
            },
            render: (props) => (
              <select
                {...props}
                aria-label="View"
                className="h-6.5 form-control w-auto px-2 text-sm"
                onChange={(event) => setView(event.target.value)}
                value={view}
              >
                {views.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ),
            type: "custom",
          },
          { type: "separator" },
          {
            icon: <Plus size={14} />,
            id: "new",
            label: "New order",
            onClick: () => enqueueSnackbar("New order"),
            priority: 1,
          },
        ]}
        size="sm"
      />
    </div>
  );
}
