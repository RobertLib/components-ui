import docs from "../lib/docgen";
import InlineCode from "./inline-code";

interface PropsTableProps {
  /**
   * A component (`Button` - its `ButtonProps` and defaults) or any exported
   * type (`LoadOptionsParams`).
   */
  of: string;
  /** Heading above the table - the name by default. */
  title?: string;
}

/** The props of a component or the fields of a type, read from the source. */
export default function PropsTable({ of, title }: PropsTableProps) {
  const typeName = docs.types[`${of}Props`] ? `${of}Props` : of;
  const type = docs.types[typeName];

  if (!type) {
    throw new Error(`No documented type for "${of}"`);
  }

  return (
    <div className="my-6">
      {title !== "" && (
        <h3 className="mb-2 font-mono text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {title ?? typeName}
        </h3>
      )}
      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-neutral-50 text-xs tracking-wide text-neutral-500 uppercase dark:bg-neutral-900 dark:text-neutral-400">
            <tr>
              <th className="px-3 py-2 font-semibold">Prop</th>
              <th className="px-3 py-2 font-semibold">Type</th>
              <th className="px-3 py-2 font-semibold">Default</th>
              <th className="px-3 py-2 font-semibold">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {type.props.map((prop) => (
              <tr className="align-top" key={prop.name}>
                <td className="px-3 py-2 font-mono text-[13px] whitespace-nowrap text-neutral-900 dark:text-neutral-100">
                  {prop.name}
                  {prop.required && (
                    <span
                      className="text-danger-700 dark:text-danger-400"
                      title="Required"
                    >
                      *
                    </span>
                  )}
                </td>
                <td className="max-w-72 px-3 py-2 font-mono text-[12px] break-words text-primary-700 dark:text-primary-300">
                  {prop.type}
                </td>
                <td className="px-3 py-2 font-mono text-[12px] whitespace-nowrap text-neutral-600 dark:text-neutral-400">
                  {prop.defaultValue ?? "-"}
                </td>
                <td className="px-3 py-2 text-neutral-700 dark:text-neutral-300">
                  <InlineCode text={prop.description} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {type.extends.length > 0 && (
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          Also accepts all props of{" "}
          {type.extends.map((base, index) => (
            <span key={base}>
              {index > 0 && ", "}
              <code className="rounded bg-neutral-200/60 px-1 py-0.5 font-mono text-[0.85em] dark:bg-neutral-800">
                {base}
              </code>
            </span>
          ))}
          .
        </p>
      )}
    </div>
  );
}
