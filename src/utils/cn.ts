type ClassValue =
  | string
  | number
  | boolean
  | undefined
  | null
  | ClassValue[]
  | Record<string, unknown>;

function toVal(mix: ClassValue): string {
  if (typeof mix === "string" || typeof mix === "number") return mix.toString();

  const res: string[] = [];

  if (Array.isArray(mix)) {
    for (let i = 0; i < mix.length; i++) {
      const val = toVal(mix[i]);
      if (val) res.push(val);
    }
  } else if (typeof mix === "object" && mix !== null) {
    for (const key in mix) {
      if (
        Object.prototype.hasOwnProperty.call(mix, key) &&
        (mix as Record<string, unknown>)[key]
      ) {
        res.push(key);
      }
    }
  }

  return res.join(" ");
}

export function cn(...args: ClassValue[]): string | undefined {
  const res: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const val = toVal(args[i]);
    if (val) res.push(val);
  }

  if (res.length === 0) return undefined;

  return res.join(" ");
}

export default cn;
