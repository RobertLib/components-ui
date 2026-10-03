// What the choice controls built on native checkboxes and radios do while
// `readOnly` - which native checkboxes and radios do not have: they stay
// focusable and are submitted, but a click, Space or an arrow key changes
// nothing.

/** Calls nothing - the `onChange` of a read-only control. */
export const ignoreChange = () => {};

/**
 * Keeps a read-only checkbox (or switch) as it is on a click - also one of
 * its label, or Space: the click has toggled it by now, and this toggles it
 * back. Through the property React tracks the value by - it knows the value
 * did not change, and the next click of a checkbox no longer read-only
 * reaches `onChange`. (A canceled click would be put back by the browser
 * past that property.) The click also cleared the partly checked state -
 * `indeterminate` is what it was.
 */
export function keepCheckboxState(
  event: React.MouseEvent<HTMLInputElement>,
  indeterminate?: boolean,
) {
  const checkbox = event.currentTarget;
  checkbox.checked = !checkbox.checked;
  if (indeterminate !== undefined) checkbox.indeterminate = indeterminate;
}

/**
 * Keeps the pick of a read-only radio group on a click - React puts back
 * the `checked` of the controlled radios.
 */
export function keepRadioState(event: React.MouseEvent<HTMLInputElement>) {
  event.preventDefault();
}

const isRtl = (element: Element) =>
  getComputedStyle(element).direction === "rtl";

/**
 * The arrow keys of a read-only radio group: they move the focus to the
 * next or the previous radio of `group` - round at the ends, past the
 * disabled ones, Left and Right swapped in a right-to-left page - and leave
 * the pick alone, where the browser would pick the radio too. Returns
 * whether the key was one of them.
 */
export function moveReadOnlyRadioFocus(
  event: React.KeyboardEvent<HTMLInputElement>,
  group: Element | null,
) {
  const { key } = event;
  const radio = event.currentTarget;
  const forward =
    key === "ArrowDown" ||
    (key === "ArrowRight" && !isRtl(radio)) ||
    (key === "ArrowLeft" && isRtl(radio));
  const back =
    key === "ArrowUp" ||
    (key === "ArrowLeft" && !isRtl(radio)) ||
    (key === "ArrowRight" && isRtl(radio));
  if (!forward && !back) return false;

  event.preventDefault();
  const radios = Array.from(
    group?.querySelectorAll<HTMLInputElement>(
      "input[type='radio']:not(:disabled)",
    ) ?? [],
  );
  const index = radios.indexOf(radio);
  if (index === -1 || radios.length < 2) return true;

  const next = (index + (forward ? 1 : -1) + radios.length) % radios.length;
  radios[next].focus();
  return true;
}
