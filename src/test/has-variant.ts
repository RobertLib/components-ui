/**
 * Whether a `has-[…]:utility` class of the element applies - the CSS is not
 * loaded in the tests, so the selector Tailwind writes for the variant
 * (`:has(…)`, an underscore for a space) is matched against the element.
 */
export function hasVariantApplies(element: Element, utility: string) {
  return [...element.classList].some((name) => {
    const match = /^has-\[(.+)\]:(.+)$/.exec(name);
    return (
      match?.[2] === utility &&
      element.matches(`:has(${match[1].replaceAll("_", " ")})`)
    );
  });
}
