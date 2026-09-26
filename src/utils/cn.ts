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

// Conflicting Tailwind classes. A component puts its own classes first and
// the `className` of the page last, so of two classes that set the same CSS
// property the later one is kept - `cn("p-6", "p-0")` is "p-0". Without
// this, the one later in the generated stylesheet would win, which is often
// the component's own. Only classes whose property is certain are merged:
// any other class - a custom utility, a plugin's class, a value that could be
// a color or a size - is always kept.

/** Classes that are a whole utility on their own, by the group they are in. */
const STANDALONE: Record<string, string> = {
  absolute: "position",
  block: "display",
  border: "border-w",
  capitalize: "text-transform",
  collapse: "visibility",
  contents: "display",
  fixed: "position",
  flex: "display",
  "flow-root": "display",
  grid: "display",
  grow: "grow",
  hidden: "display",
  inline: "display",
  "inline-block": "display",
  "inline-flex": "display",
  "inline-grid": "display",
  "inline-table": "display",
  invisible: "visibility",
  italic: "font-style",
  "line-through": "text-decoration-line",
  "list-item": "display",
  lowercase: "text-transform",
  "no-underline": "text-decoration-line",
  "normal-case": "text-transform",
  "not-italic": "font-style",
  overline: "text-decoration-line",
  relative: "position",
  ring: "ring-w",
  rounded: "rounded",
  shadow: "shadow",
  shrink: "shrink",
  static: "position",
  sticky: "position",
  table: "display",
  "table-cell": "display",
  "table-row": "display",
  transition: "transition",
  underline: "text-decoration-line",
  uppercase: "text-transform",
  visible: "visibility",
};

/** A theme or arbitrary value: `4`, `2.5`, `[12px]`, `(--gap)` */
const NUMBER = /^\d+(?:\.\d+)?$/;
const ARBITRARY = /^(?:\[.+\]|\(.+\))$/;

const isSpacing = (value: string) =>
  NUMBER.test(value) || value === "px" || ARBITRARY.test(value);

/** `top-1/2`, `inset-full`, `-translate-x-full` */
const isInset = (value: string) =>
  isSpacing(value) || /^(?:\d+\/\d+|auto|full)$/.test(value);

/** `w-1/2`, `h-dvh`, `max-w-md`, `min-w-fit`, … */
const isSize = (value: string) =>
  isInset(value) ||
  /^(?:screen|min|max|fit|none|prose|[sld]v[wh]|[23]?xs|sm|md|lg|[2-7]?xl)$/.test(
    value,
  );

/** A number or an arbitrary value, or one of `words`. */
const numberOr =
  (...words: string[]) =>
  (value: string) =>
    NUMBER.test(value) || ARBITRARY.test(value) || words.includes(value);

/** One of `words` or an arbitrary value. */
const oneOf =
  (...words: string[]) =>
  (value: string) =>
    ARBITRARY.test(value) || words.includes(value);

/**
 * Prefixes whose group is the prefix itself, with the values that are
 * theirs. A value outside - a custom class like `top-bar` or `size-hint` -
 * makes the class conflict with nothing.
 */
const PREFIXES: Record<string, (value: string) => boolean> = {
  animate: () => true,
  aspect: (value) =>
    ARBITRARY.test(value) || /^(?:square|video|auto|\d+\/\d+)$/.test(value),
  basis: isSize,
  cursor: (value) =>
    /^[a-z]+(?:-[a-z]+)*$/.test(value) || ARBITRARY.test(value),
  delay: numberOr("initial"),
  duration: numberOr("initial"),
  ease: oneOf("linear", "in", "out", "in-out", "initial"),
  "grid-cols": numberOr("none", "subgrid"),
  "grid-rows": numberOr("none", "subgrid"),
  grow: numberOr(),
  leading: numberOr("none", "tight", "snug", "normal", "relaxed", "loose"),
  opacity: numberOr(),
  order: numberOr("first", "last", "none"),
  "pointer-events": oneOf("none", "auto"),
  select: oneOf("none", "text", "all", "auto"),
  shrink: numberOr(),
  tracking: oneOf("tighter", "tight", "normal", "wide", "wider", "widest"),
  whitespace: oneOf(
    "normal",
    "nowrap",
    "pre",
    "pre-line",
    "pre-wrap",
    "break-spaces",
  ),
  z: numberOr("auto"),
};

for (const prefix of ["p", "px", "py", "ps", "pe", "pt", "pr", "pb", "pl"]) {
  PREFIXES[prefix] = isSpacing;
}
for (const prefix of ["m", "mx", "my", "ms", "me", "mt", "mr", "mb", "ml"]) {
  PREFIXES[prefix] = (value) => isSpacing(value) || value === "auto";
}
for (const prefix of ["gap", "gap-x", "gap-y", "space-x", "space-y"]) {
  PREFIXES[prefix] = isSpacing;
}
for (const prefix of [
  "inset",
  "inset-x",
  "inset-y",
  "top",
  "right",
  "bottom",
  "left",
  "start",
  "end",
  "translate-x",
  "translate-y",
]) {
  PREFIXES[prefix] = isInset;
}
for (const prefix of ["w", "h", "size", "min-w", "max-w", "min-h", "max-h"]) {
  PREFIXES[prefix] = isSize;
}

/**
 * The groups a later class of a group overrides besides its own - a later
 * `p-0` also replaces an earlier `px-4`, a later `px-0` not an earlier `p-4`.
 */
const OVERRIDES: Record<string, string[]> = {
  gap: ["gap-x", "gap-y"],
  inset: [
    "inset-x",
    "inset-y",
    "top",
    "right",
    "bottom",
    "left",
    "start",
    "end",
  ],
  "inset-x": ["left", "right", "start", "end"],
  "inset-y": ["top", "bottom"],
  overflow: ["overflow-x", "overflow-y"],
  rounded: [
    "rounded-s",
    "rounded-e",
    "rounded-t",
    "rounded-r",
    "rounded-b",
    "rounded-l",
    "rounded-ss",
    "rounded-se",
    "rounded-ee",
    "rounded-es",
    "rounded-tl",
    "rounded-tr",
    "rounded-br",
    "rounded-bl",
  ],
  "rounded-s": ["rounded-ss", "rounded-es"],
  "rounded-e": ["rounded-se", "rounded-ee"],
  "rounded-t": ["rounded-tl", "rounded-tr"],
  "rounded-r": ["rounded-tr", "rounded-br"],
  "rounded-b": ["rounded-br", "rounded-bl"],
  "rounded-l": ["rounded-tl", "rounded-bl"],
  size: ["w", "h"],
};

// The four sides of the box: m, p, border width and border color override
// the same way - all sides, then x / y
for (const [all, prefix] of [
  ["m", "m"],
  ["p", "p"],
  ["border-w", "border-w-"],
  ["border-color", "border-color-"],
]) {
  const side = (name: string) => `${prefix}${name}`;
  OVERRIDES[all] = ["x", "y", "s", "e", "t", "r", "b", "l"].map(side);
  OVERRIDES[side("x")] = ["s", "e", "r", "l"].map(side);
  OVERRIDES[side("y")] = ["t", "b"].map(side);
}

const FONT_SIZES = new Set([
  "xs",
  "sm",
  "base",
  "lg",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
  "6xl",
  "7xl",
  "8xl",
  "9xl",
]);

const FONT_WEIGHTS = new Set([
  "thin",
  "extralight",
  "light",
  "normal",
  "medium",
  "semibold",
  "bold",
  "extrabold",
  "black",
]);

const SHADOW_SIZES = new Set([
  "2xs",
  "xs",
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
  "none",
  "inner",
]);

/** `items-center`, `self-end`, `justify-items-start`, … */
const ALIGNMENTS =
  /^(?:start|end|center|baseline|stretch|end-safe|center-safe|baseline-last|normal)$/;

const RADII = /^(?:none|xs|sm|md|lg|xl|[234]xl|full|\[.+\]|\(.+\))$/;

const LINE_STYLES = new Set([
  "solid",
  "dashed",
  "dotted",
  "double",
  "hidden",
  "none",
]);

/** `primary-500`, `white`, `black/5`, `[#0af]`, `(color:--brand)`, … */
function isColor(value: string) {
  // Without the opacity: `primary-500/40`, `black/[.3]`
  const color = value.replace(/\/(?:\d+|\[[^\]]*\]|\([^)]*\))$/, "");

  return (
    /^(?:inherit|current|transparent|black|white)$/.test(color) ||
    // A palette color with its shade - the library's and Tailwind's own
    /^[a-z]+(?:-[a-z]+)*-(?:50|[1-9]00|950)$/.test(color) ||
    // The library's single colors
    /^(?:background|surface)(?:-dark)?$/.test(color) ||
    /^\[(?:color:|#|(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch|color|color-mix|light-dark)\(|var\(--color-)/.test(
      color,
    ) ||
    /^\((?:color:|--color-)/.test(color)
  );
}

/** `2`, `[1.5px]`, `(length:--gap)` - a width of a border, ring, … */
function isLength(value: string) {
  return (
    /^\d+(?:\.\d+)?$/.test(value) ||
    /^\[(?:length:[^\]]+|-?\d*\.?\d+(?:px|r?em|%|vh|vw|dvh|svh|lvh|ch|ex|lh)?|(?:calc|clamp|min|max)\([^\]]*\))\]$/.test(
      value,
    ) ||
    /^\(length:[^)]+\)$/.test(value)
  );
}

/** The group of a utility without its variants, `!` and minus sign. */
function utilityGroup(utility: string): string | undefined {
  const standalone = STANDALONE[utility];
  if (standalone) return standalone;

  // The longest prefix first: `min-w-0` is `min-w`, not `min`
  const parts = utility.split("-");
  for (let length = Math.min(parts.length - 1, 3); length > 0; length--) {
    const prefix = parts.slice(0, length).join("-");
    const value = parts.slice(length).join("-");
    const group = prefixedGroup(prefix, value);
    if (group) return group;
  }

  return undefined;
}

/** `lg`, `lg/20`, `none` - the shadow of the text of `text-shadow-…`. */
const TEXT_SHADOW =
  /^(?:(?:2xs|xs|sm|md|lg)(?:\/(?:\d+|\[[^\]]*\]|\([^)]*\)))?|none)$/;

/** The group of `text-shadow-{value}` - the shadow or its color. */
function textShadowGroup(value: string): string | undefined {
  if (TEXT_SHADOW.test(value)) return "text-shadow";
  return isColor(value) ? "text-shadow-color" : undefined;
}

/** The group of `prefix-value`, e.g. `text` + `sm` - `font-size`. */
function prefixedGroup(prefix: string, value: string): string | undefined {
  if (!value) return undefined;

  const isValue = PREFIXES[prefix];
  if (isValue) return isValue(value) ? prefix : undefined;

  switch (prefix) {
    case "flex":
      if (/^(?:row|row-reverse|col|col-reverse)$/.test(value)) {
        return "flex-direction";
      }
      if (/^(?:wrap|wrap-reverse|nowrap)$/.test(value)) return "flex-wrap";
      return numberOr("auto", "initial", "none")(value) ||
        /^\d+\/\d+$/.test(value)
        ? "flex"
        : undefined;
    case "items":
      return ALIGNMENTS.test(value) ? "align-items" : undefined;
    case "self":
      return value === "auto" || ALIGNMENTS.test(value)
        ? "align-self"
        : undefined;
    case "justify": {
      // `justify-items-center`, `justify-self-end`, `justify-between`
      const [, part, alignment] = /^(?:(items|self)-)?(.+)$/.exec(value) ?? [];
      if (!alignment || !(ALIGNMENTS.test(alignment) || alignment === "auto")) {
        return /^(?:between|around|evenly|normal)$/.test(value)
          ? "justify-content"
          : undefined;
      }
      return part ? `justify-${part}` : "justify-content";
    }
    case "object":
      if (/^(?:contain|cover|fill|none|scale-down)$/.test(value)) {
        return "object-fit";
      }
      return /^(?:top|bottom|left|right|center|left-top|left-bottom|right-top|right-bottom|\[.+\])$/.test(
        value,
      )
        ? "object-position"
        : undefined;
    case "overflow": {
      const [, axis, overflow] = /^(?:([xy])-)?(.+)$/.exec(value) ?? [];
      if (!/^(?:auto|hidden|clip|visible|scroll)$/.test(overflow ?? "")) {
        return undefined;
      }
      return axis ? `overflow-${axis}` : "overflow";
    }
    case "font":
      if (FONT_WEIGHTS.has(value) || /^\[\d+\]$/.test(value)) {
        return "font-weight";
      }
      return /^(?:sans|serif|mono)$/.test(value) ? "font-family" : undefined;
    case "text":
      // `text-sm/6` - a size with a line height
      if (FONT_SIZES.has(value.replace(/\/.*$/, ""))) return "font-size";
      if (/^(?:left|center|right|justify|start|end)$/.test(value)) {
        return "text-align";
      }
      if (/^(?:wrap|nowrap|balance|pretty)$/.test(value)) return "text-wrap";
      if (/^(?:ellipsis|clip)$/.test(value)) return "text-overflow";
      // `text-shadow-lg`, `text-shadow-sky-300` - the shadow of the text
      // and its color, not the color of the text
      if (/^shadow(?:-|$)/.test(value)) return textShadowGroup(value.slice(7));
      if (isColor(value)) return "text-color";
      return /^[[(]/.test(value) && isLength(value) ? "font-size" : undefined;
    case "bg":
      if (isColor(value)) return "bg-color";
      return /^(?:none|linear-|radial|conic|gradient-|\[url\(|\[(?:image:)?(?:linear|radial|conic)-gradient)/.test(
        value,
      )
        ? "bg-image"
        : undefined;
    case "from":
    case "via":
    case "to":
      return isColor(value) ? `${prefix}-color` : undefined;
    case "border": {
      // `border-t`, `border-x-2`, `border-b-primary-500`
      const side = /^([xysetrbl])(?:-(.+))?$/.exec(value);
      if (side) {
        if (side[2] === undefined || isLength(side[2])) {
          return `border-w-${side[1]}`;
        }
        return isColor(side[2]) ? `border-color-${side[1]}` : undefined;
      }
      if (isLength(value)) return "border-w";
      if (LINE_STYLES.has(value)) return "border-style";
      return isColor(value) ? "border-color" : undefined;
    }
    case "rounded": {
      // `rounded-t`, `rounded-bl-lg`, `rounded-md`
      const [, side, radius] =
        /^(?:(ss|se|ee|es|tl|tr|br|bl|[setrbl])(?:-|$))?(.*)$/.exec(value) ??
        [];
      if (radius && !RADII.test(radius)) return undefined;
      return side ? `rounded-${side}` : "rounded";
    }
    case "ring":
      if (value === "inset") return "ring-inset";
      if (isLength(value)) return "ring-w";
      return isColor(value) ? "ring-color" : undefined;
    case "ring-offset":
      if (isLength(value)) return "ring-offset-w";
      return isColor(value) ? "ring-offset-color" : undefined;
    case "shadow":
      if (SHADOW_SIZES.has(value)) return "shadow";
      return isColor(value) ? "shadow-color" : undefined;
    case "outline":
      if (LINE_STYLES.has(value)) return "outline-style";
      if (isLength(value)) return "outline-w";
      return isColor(value) ? "outline-color" : undefined;
    case "outline-offset":
      return "outline-offset";
    case "transition":
      return /^(?:all|colors|opacity|shadow|transform|none)$/.test(value)
        ? "transition"
        : undefined;
    default:
      return undefined;
  }
}

/**
 * What a class conflicts by: its variants (mostly in any order -
 * `dark:hover:` is `hover:dark:`), whether it is important, and its group.
 */
interface ClassConflict {
  /** The variants and `!` - classes conflict only under the same ones. */
  scope: string;
  group: string;
}

/** `hover:md:px-2` -> the variants and the utility, brackets respected. */
function splitVariants(className: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < className.length; i++) {
    const char = className[i];
    if (char === "[" || char === "(") depth++;
    else if (char === "]" || char === ")") depth--;
    else if (char === ":" && depth === 0) {
      parts.push(className.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(className.slice(start));

  return parts;
}

/**
 * Variants that move to other elements - children, pseudo-elements.
 * Tailwind applies the variants from left to right, so their place among
 * the others matters: `*:hover:` styles a hovered child, `hover:*:` the
 * children of a hovered element.
 */
const ORDER_SENSITIVE_VARIANT =
  /^(?:\*|\*\*|after|backdrop|before|details-content|file|first-letter|first-line|marker|placeholder|selection)$/;

/**
 * Whether an arbitrary variant moves to another element: something follows
 * its `&` - `[&>svg]`, `[&_p]`, `[&::marker]` - or it has none. `[&.active]`
 * and `[fieldset:disabled_&]` stay with the element of the class.
 */
function isMovingArbitraryVariant(variant: string) {
  if (!/^\[.*\]$/.test(variant)) return false;

  const selector = variant.slice(1, -1);
  const self = selector.lastIndexOf("&");
  return self === -1 || /[_\s>+~]|::/.test(selector.slice(self + 1));
}

/**
 * Variants of a media, container or feature query (also their `not-`) -
 * they select no other element, so they apply the same wherever they
 * stand: `md:*:` is `*:md:`. Not `dark`, a media query only by default -
 * made a class (`@custom-variant dark`), `placeholder:dark:` is a selector
 * no browser takes, `dark:placeholder:` one that works.
 */
const AT_RULE_VARIANT =
  /^(?:not-)?(?:sm|md|lg|xl|2xl|(?:max|min)-.+|@.+|motion-(?:safe|reduce)|print|portrait|landscape|supports-.+|contrast-(?:more|less)|forced-colors|inverted-colors|(?:any-)?pointer-(?:fine|coarse|none)|noscript|starting|\[@(?:media|supports|container)[^\]]*\])$/;

/**
 * The variants as one text: the queries in any order, the others sorted
 * between the order-sensitive ones.
 */
function variantScope(variants: string[]) {
  const queries: string[] = [];
  const scope: string[] = [];
  let run: string[] = [];

  for (const variant of variants) {
    if (AT_RULE_VARIANT.test(variant)) {
      queries.push(variant);
    } else if (
      ORDER_SENSITIVE_VARIANT.test(variant) ||
      isMovingArbitraryVariant(variant)
    ) {
      scope.push(...run.sort(), variant);
      run = [];
    } else {
      run.push(variant);
    }
  }
  scope.push(...run.sort());

  return `${queries.sort().join(":")};${scope.join(":")}`;
}

/** `undefined` for a class that conflicts with nothing. */
function parseClass(className: string): ClassConflict | undefined {
  const parts = splitVariants(className);
  let utility = parts.pop() ?? "";

  // `!p-0` (Tailwind 3) and `p-0!` (Tailwind 4)
  const important = utility.startsWith("!") || utility.endsWith("!");
  utility = utility.replace(/^!|!$/g, "");
  // `-mt-px` sets the same property as `mt-2`
  utility = utility.replace(/^-/, "");

  const group = utilityGroup(utility);
  if (!group) return undefined;

  return {
    group,
    scope: `${variantScope(parts)}${important ? "!" : ""}|`,
  };
}

// The same class names come by on every render - each is parsed once
const parsedClasses = new Map<string, ClassConflict | null>();

function conflictOf(className: string) {
  let conflict = parsedClasses.get(className);
  if (conflict === undefined) {
    // Bounded, in case class names are generated (`w-[${width}px]`)
    if (parsedClasses.size >= 2000) parsedClasses.clear();
    conflict = parseClass(className) ?? null;
    parsedClasses.set(className, conflict);
  }

  return conflict;
}

/** Leaves out the classes a later one overrides, and repeated ones. */
function mergeClasses(classes: string[]): string[] {
  const kept: string[] = [];
  const seen = new Set<string>();
  const overridden = new Set<string>();

  // From the end: the last class of a group stays
  for (let i = classes.length - 1; i >= 0; i--) {
    const className = classes[i];
    if (seen.has(className)) continue;
    seen.add(className);

    const conflict = conflictOf(className);
    if (conflict) {
      const key = conflict.scope + conflict.group;
      if (overridden.has(key)) continue;

      overridden.add(key);
      for (const group of OVERRIDES[conflict.group] ?? []) {
        overridden.add(conflict.scope + group);
      }
    }

    kept.push(className);
  }

  return kept.reverse();
}

/**
 * Joins class names - strings, numbers, arrays and objects whose keys are
 * included when their value is truthy - and resolves conflicting Tailwind
 * classes: the later one stays. `undefined` when there is none.
 */
export function cn(...args: ClassValue[]): string | undefined {
  const res: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const val = toVal(args[i]);
    if (val) res.push(...val.split(/\s+/).filter(Boolean));
  }

  if (res.length === 0) return undefined;

  return mergeClasses(res).join(" ");
}

/**
 * Joins space-separated tokens that are not classes - the ids of
 * `aria-describedby`, the values of `rel` - like `cn`, but keeps every one:
 * `size-error size-hint` are two ids, not two sizes. `undefined` when there
 * is none.
 */
export function joinTokens(...args: ClassValue[]): string | undefined {
  const res: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const val = toVal(args[i]);
    if (val) res.push(val);
  }

  if (res.length === 0) return undefined;

  return res.join(" ");
}

export default cn;
