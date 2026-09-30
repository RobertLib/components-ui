/**
 * A dictionary keyed by column or group names. No inherited entries:
 * `constructor`, `toString` and `__proto__` are ordinary keys, also when
 * entries are assigned individually. Copies only the source's own entries.
 */
export default function columnRecord<T>(source?: Readonly<Record<string, T>>) {
  return Object.assign(Object.create(null) as Record<string, T>, source);
}
