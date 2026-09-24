import { CopyButton, useSnackbar } from "components-ui";

const keys = [
  { name: "Production", value: "crm_live_7f3a9c2e41d8b605" },
  { name: "Staging", value: "crm_test_2b6e0d91c4a7f358" },
];

export default function ApiKeys() {
  const { enqueueSnackbar } = useSnackbar();

  return (
    <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
      {keys.map((key) => (
        <li className="flex items-center gap-3 px-3 py-2" key={key.name}>
          <div className="min-w-0 flex-1">
            <div className="font-medium">{key.name}</div>
            <code className="block truncate text-sm text-neutral-500 dark:text-neutral-400">
              {key.value}
            </code>
          </div>
          <CopyButton
            label={`Copy the ${key.name.toLowerCase()} key`}
            onCopied={() =>
              enqueueSnackbar(`${key.name} key copied`, "success")
            }
            tooltipPosition="left"
            value={key.value}
            variant="primary"
          />
        </li>
      ))}
    </ul>
  );
}
