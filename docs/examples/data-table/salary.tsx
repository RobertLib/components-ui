import { useLocale } from "components-ui";

/**
 * A salary in the number format of the language of `UIProvider` - used by
 * the `render` of the salary columns of the DataTable examples.
 */
export function Salary({ value }: { value: number }) {
  const { code } = useLocale();

  return (
    <span className="whitespace-nowrap tabular-nums">
      {new Intl.NumberFormat(code).format(value)} CZK
    </span>
  );
}
