export type Debounced<T extends (...args: never[]) => void> = ((
  ...args: Parameters<T>
) => void) & {
  /** Drops the pending call, e.g. when the component unmounts. */
  cancel: () => void;
};

export default function debounce<T extends (...args: never[]) => void>(
  func: T,
  wait = 500,
): Debounced<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);

    timeout = setTimeout(() => {
      timeout = null;
      func(...args);
    }, wait);
  };

  debounced.cancel = () => {
    if (timeout) clearTimeout(timeout);
    timeout = null;
  };

  return debounced;
}
