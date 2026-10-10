// What a press inside the frame of a field leaves alone: the field itself
// (a select with the options of a list box), and the controls of an
// adornment (a currency select, a button)
const CONTROL_SELECTOR =
  "a[href], button, input, select, textarea, [contenteditable], [tabindex]";

/**
 * Whether a press on `target` belongs to a control inside the frame of a
 * field - the input or the select itself, an option of a list box, a button
 * of an adornment - rather than to the frame around them. Also one outside
 * the frame, which React passes on to it from a portal (the text of a
 * popover opened by an adornment): it is no press on the frame.
 */
export function isControlTarget(target: EventTarget, frame: Element) {
  if (!(target instanceof Node) || !frame.contains(target)) return true;

  for (
    let node = target instanceof Element ? target : null;
    node && node !== frame;
    node = node.parentElement
  ) {
    if (node.matches(CONTROL_SELECTOR)) return true;
  }
  return false;
}
