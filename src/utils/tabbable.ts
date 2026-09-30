// Everything Tab may stop at - also the summary of a <details>, a frame,
// media with controls and an editing host (`contenteditable`)
const TABBABLE =
  "a[href], button, input:not([type='hidden']), select, textarea, summary, iframe, audio[controls], video[controls], [contenteditable], [tabindex]";

// Tab stops whose `tabIndex` says -1 until a `tabindex` is given
const IMPLICIT_TAB_STOP =
  "[contenteditable]:not([contenteditable='false']), audio[controls], video[controls]";

/** The parent in the rendered tree, including slots and shadow hosts. */
const composedParent = (element: Element): Element | null => {
  if (element.assignedSlot) return element.assignedSlot;
  const parent = element.parentNode;
  return parent instanceof ShadowRoot ? parent.host : element.parentElement;
};

/** Whether `node` is inside `container`, across slots and shadow roots too. */
export const composedContains = (container: Element, node: Node | null) => {
  for (
    let current: Node | null = node;
    current;
    current =
      current instanceof Element
        ? composedParent(current)
        : current instanceof ShadowRoot
          ? current.host
          : current.parentNode
  ) {
    if (current === container) return true;
  }
  return false;
};

/** The rendered children: a host's shadow tree, or a slot's assigned nodes. */
const composedChildren = (
  container: ParentNode,
  knownRoots?: Map<Element, ShadowRoot>,
): HTMLCollectionOf<Element> | Element[] => {
  if (container instanceof Element) {
    const shadow = container.shadowRoot ?? knownRoots?.get(container);
    if (shadow) return shadow.children;
  }
  if (
    container instanceof HTMLSlotElement &&
    container.assignedNodes().length
  ) {
    return container.assignedElements({ flatten: true });
  }
  return container.children;
};

/**
 * Candidates in rendered order, with the position just after `anchor`.
 * Document selectors and compareDocumentPosition cannot order elements in
 * different shadow roots. Walking the tree also leaves out unslotted light
 * DOM and keeps slotted controls in the order in which Tab reaches them.
 */
function collectTabCandidates(
  container: ParentNode | null | undefined,
  anchor?: Element,
) {
  const elements: HTMLElement[] = [];
  // A reference inside a closed root still gives access to that root and
  // its ancestors, even though their hosts do not expose `shadowRoot`.
  const knownRoots = new Map<Element, ShadowRoot>();
  let root = anchor?.getRootNode();
  while (root instanceof ShadowRoot) {
    knownRoots.set(root.host, root);
    root = root.host.getRootNode();
  }
  let after = -1;
  const visit = (element: Element) => {
    if (element.matches(TABBABLE)) elements.push(element as HTMLElement);
    if (element === anchor) after = elements.length;
    for (const child of composedChildren(element, knownRoots)) visit(child);
  };
  if (container) {
    for (const child of composedChildren(container, knownRoots)) visit(child);
  }
  return { elements, after };
}

/**
 * Whether an element is in the editable content of an editing host - Tab
 * stops at the host, not at an editable element or a link in it (its
 * controls are still stops). A part with `contenteditable="false"` is not
 * editable.
 */
const isInsideEditingHost = (element: HTMLElement) => {
  const host = element.parentElement?.closest("[contenteditable]");
  return !!host && host.getAttribute("contenteditable") !== "false";
};

/** The `tabIndex` Tab goes by. */
const tabIndexOf = (element: HTMLElement) => {
  if (element.hasAttribute("tabindex")) return element.tabIndex;
  if (element.matches(IMPLICIT_TAB_STOP)) {
    return isInsideEditingHost(element) ? element.tabIndex : 0;
  }
  // A link in editable text is part of the text: browsers give it no
  // focus, unlike a control there
  return element.matches("a[href]") && isInsideEditingHost(element)
    ? -1
    : element.tabIndex;
};

const isRadio = (element: Element): element is HTMLInputElement =>
  element instanceof HTMLInputElement && element.type === "radio";

/**
 * Whether Tab stops at a radio: the radios of a group (one `name` in one
 * form) are a single stop - the focused one while the focus is in the group
 * (the arrow keys move it, and a controlled group may refuse the change),
 * otherwise the checked one, or the first without a checked one.
 */
function isRadioTabStop(radio: HTMLInputElement, candidates: HTMLElement[]) {
  if (!radio.name) return true;

  const group = candidates.filter(
    (candidate): candidate is HTMLInputElement =>
      isRadio(candidate) &&
      candidate.name === radio.name &&
      candidate.form === radio.form &&
      candidate.getRootNode() === radio.getRootNode(),
  );
  const root = radio.getRootNode();
  const focused =
    root instanceof ShadowRoot
      ? root.activeElement
      : radio.ownerDocument.activeElement;

  return (
    radio ===
    (group.find((candidate) => candidate === focused) ??
      group.find((candidate) => candidate.checked) ??
      group[0])
  );
}

/**
 * The elements Tab stops at inside `container`, in order: controls, links,
 * the summary of a `<details>`, frames, media with controls, editing hosts
 * and elements with a `tabindex`. Left out are those the selector also
 * matches but Tab skips: `tabindex="-1"`, disabled, aria-hidden and
 * unrendered ones - such as the validation inputs of the pickers and the
 * file input of `FileUpload` - the links and editable elements in editable
 * text, and all but one radio of a group.
 */
export const getTabbableElements = (
  container: ParentNode | null | undefined,
) => {
  const candidates =
    collectTabCandidates(container).elements.filter(isTabStopCandidate);

  return candidates.filter(
    (element) => !isRadio(element) || isRadioTabStop(element, candidates),
  );
};

/** Whether Tab stops at `element`, leaving aside the radios of a group. */
function isTabStopCandidate(element: HTMLElement) {
  for (
    let current: Element | null = element;
    current;
    current = composedParent(current)
  ) {
    if (current.matches("[aria-hidden='true'], [inert]")) return false;
  }
  return (
    tabIndexOf(element) >= 0 &&
    !element.matches(":disabled") &&
    // Older browsers (and jsdom) lack it - the element counts as visible
    element.checkVisibility?.({ visibilityProperty: true }) !== false
  );
}

/**
 * Whether Tab stops at `candidate`, one of the `elements` of the page - a
 * radio for its group, which is all the check needs.
 */
function isTabStopAmong(candidate: HTMLElement, elements: HTMLElement[]) {
  if (!isTabStopCandidate(candidate)) return false;
  if (!isRadio(candidate)) return true;

  const group = elements.filter(
    (other) =>
      isRadio(other) &&
      other.name === candidate.name &&
      isTabStopCandidate(other),
  );
  return isRadioTabStop(candidate, group);
}

/**
 * The elements Tab may stop at, from `element` on in the page - after it,
 * or before it with `backwards` - with all of them (to find the radios of a
 * group).
 */
function tabCandidatesBeside(element: Element, backwards: boolean) {
  if (!element.isConnected) return { beside: [], elements: [] };

  const { elements, after } = collectTabCandidates(
    element.ownerDocument.body,
    element,
  );
  if (after === -1) return { beside: [], elements };

  const beside = backwards
    ? elements
        .slice(0, after)
        .filter((candidate) => candidate !== element)
        .reverse()
    : elements.slice(after);
  return { beside, elements };
}

/**
 * The first Tab stop after `element` in the page - or before it, with
 * `backwards` - outside of it and of `skipped`. It checks the elements from
 * `element` on only until it finds one: finding the stop next to a button
 * in a long table is no check of every control in the page.
 */
function findTabStopBeside(
  element: Element,
  backwards: boolean,
  skipped?: Element | null,
): HTMLElement | undefined {
  const { beside, elements } = tabCandidatesBeside(element, backwards);

  return beside.find(
    (candidate) =>
      !composedContains(element, candidate) &&
      (!skipped || !composedContains(skipped, candidate)) &&
      isTabStopAmong(candidate, elements),
  );
}

/**
 * The Tab stops after `element` in the page - or before it, with
 * `backwards` - one for each of its ancestors, nearest first: the first
 * stop outside `element`, then the first outside its parent, and so on up
 * to the body. When `element` goes away with an ancestor - the row a pick
 * in its menu deleted, with a second button of the row after the menu
 * button - the first of them still in the page is the stop next to that
 * ancestor, the next row.
 */
export function getTabStopsBeside(element: Element, backwards: boolean) {
  const { beside, elements } = tabCandidatesBeside(element, backwards);
  const body = element.ownerDocument.body;
  // `element` and its ancestors below the body, the nearest first
  const scopes: Element[] = [];
  for (
    let current: Element | null = element;
    current && current !== body;
    current = composedParent(current)
  ) {
    scopes.push(current);
  }

  const stops: HTMLElement[] = [];
  let level = 0;
  for (const candidate of beside) {
    if (level === scopes.length) break;
    if (
      composedContains(scopes[level], candidate) ||
      !isTabStopAmong(candidate, elements)
    ) {
      continue;
    }
    stops.push(candidate);
    // The stop next to all the scopes it is outside of
    while (
      level < scopes.length &&
      !composedContains(scopes[level], candidate)
    ) {
      level += 1;
    }
  }
  return stops;
}

/**
 * The element Tab moves to from `element` - the first one after it in the
 * page that is outside of it and of `skipped` (e.g. the panel of a popover,
 * which is a portal at the end of the page).
 */
export const getNextTabbable = (
  element: Element,
  skipped?: Element | null,
): HTMLElement | undefined => findTabStopBeside(element, false, skipped);

/** The element Shift+Tab moves to from `element` - see `getNextTabbable`. */
export const getPreviousTabbable = (
  element: Element,
  skipped?: Element | null,
): HTMLElement | undefined => findTabStopBeside(element, true, skipped);

/**
 * Focuses the first of `candidates` that takes the focus - and tells whether
 * one did. A browser may give none to an element the rules make a Tab stop:
 * Firefox focuses no link in editable text, also one with a `tabindex`.
 */
export function focusFirst(candidates: Iterable<HTMLElement>) {
  for (const element of candidates) {
    element.focus();
    const root = element.getRootNode();
    if (
      (root instanceof Document || root instanceof ShadowRoot) &&
      root.activeElement === element
    ) {
      return true;
    }
  }
  return false;
}
