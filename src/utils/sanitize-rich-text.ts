interface SanitizeRules {
  /** Elements kept (upper case) - anything else is unwrapped to its text. */
  tags: ReadonlySet<string>;
  /** Attributes kept on those elements, besides the `href` of safe links. */
  attributes: ReadonlySet<string>;
  /** Classes kept - without it, `class` is kept as it is. */
  isSafeClass?: (className: string) => boolean;
}

// The formatting RichTextEditor produces
const RICH_TEXT: SanitizeRules = {
  attributes: new Set(),
  tags: new Set(["A", "B", "BR", "DIV", "EM", "I", "P", "STRONG"]),
};

// Tailwind utilities that style text in place: color, weight, size and
// decoration, a background, a border, padding. Whatever could move or
// enlarge an element beyond its line (`fixed inset-0 z-50` over the page, a
// link as an invisible overlay) is left out, as are arbitrary values -
// `bg-[url(…)]` would load from anywhere.
const SAFE_CLASS =
  /^(text|font|italic|not-italic|underline|overline|line-through|no-underline|decoration|uppercase|lowercase|capitalize|normal-case|truncate|tracking|leading|whitespace|break|bg|rounded|border|px|py)(-[a-z\d./-]+)?$/;

/**
 * A class of the allowed utilities - also behind variants (`dark:`,
 * `hover:`) and with an `!` - but not a negative or arbitrary value.
 */
function isSafeInlineClass(className: string) {
  const utility = className.slice(className.lastIndexOf(":") + 1);
  return SAFE_CLASS.test(utility.replace(/^!|!$/g, ""));
}

// Inline formatting of a single line, e.g. a calendar event title - with
// classes of text styling, so it can be styled (links get none)
const INLINE_HTML: SanitizeRules = {
  attributes: new Set(["class"]),
  isSafeClass: isSafeInlineClass,
  tags: new Set([
    "A",
    "B",
    "BR",
    "EM",
    "I",
    "MARK",
    "S",
    "SMALL",
    "SPAN",
    "STRONG",
    "SUB",
    "SUP",
    "U",
  ]),
};

// Removed together with their content, which is never meant as text
const DROPPED_TAGS = new Set([
  "EMBED",
  "HEAD",
  "IFRAME",
  "LINK",
  "MATH",
  "META",
  "NOEMBED",
  "NOFRAMES",
  "NOSCRIPT",
  "OBJECT",
  "PLAINTEXT",
  "SCRIPT",
  "STYLE",
  "SVG",
  "TEMPLATE",
  "TITLE",
  "XMP",
]);

const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

/** Absolute links with a safe scheme, and relative ones. */
export function isSafeHref(href: string) {
  try {
    // The URL parser sees through tricks like `java\tscript:`
    return SAFE_PROTOCOLS.has(
      new URL(href, "https://relative.invalid/").protocol,
    );
  } catch {
    return false;
  }
}

function cleanClasses(element: Element, rules: SanitizeRules) {
  const { isSafeClass } = rules;
  if (!isSafeClass) return;

  // A styled link could be stretched into a click trap over the page
  const kept =
    element.tagName === "A"
      ? []
      : Array.from(element.classList).filter((className) =>
          isSafeClass(className),
        );

  if (kept.length > 0) {
    element.setAttribute("class", kept.join(" "));
  } else {
    element.removeAttribute("class");
  }
}

function cleanChildren(parent: Node, rules: SanitizeRules) {
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) continue;

    if (child.nodeType !== Node.ELEMENT_NODE) {
      child.parentNode?.removeChild(child);
      continue;
    }

    const element = child as Element;

    // SVG and MathML elements keep the case of their names (`svg`, `style`)
    if (DROPPED_TAGS.has(element.tagName.toUpperCase())) {
      element.remove();
      continue;
    }

    cleanChildren(element, rules);

    // Only HTML elements - an `<a>` inside an SVG is no link
    if (
      element.namespaceURI !== HTML_NAMESPACE ||
      !rules.tags.has(element.tagName)
    ) {
      element.replaceWith(...Array.from(element.childNodes));
      continue;
    }

    for (const { name, value } of Array.from(element.attributes)) {
      const isSafeLink =
        element.tagName === "A" && name === "href" && isSafeHref(value);
      if (!isSafeLink && !rules.attributes.has(name)) {
        element.removeAttribute(name);
      }
    }

    if (element.hasAttribute("class")) cleanClasses(element, rules);
  }
}

function sanitize(html: string, rules: SanitizeRules) {
  if (!html) return "";

  const document = new DOMParser().parseFromString(html, "text/html");
  cleanChildren(document.body, rules);

  return document.body.innerHTML;
}

/**
 * Reduces HTML to what RichTextEditor itself produces - paragraphs, bold,
 * italic and links with safe URLs - so neither a loaded value nor pasted
 * content can run scripts or bring foreign styles. Browser only.
 */
export default function sanitizeRichText(html: string) {
  return sanitize(html, RICH_TEXT);
}

/**
 * Reduces HTML to inline formatting (bold, italic, `span`, `small`, links, …)
 * - no scripts, event handlers or styles. Elements other than links keep
 * the classes of text styling (`text-*`, `font-*`, `bg-*`, `underline`,
 * `rounded`, `border-*`, `px-*`, `py-*`, …), nothing that positions or
 * sizes them. Browser only.
 */
export function sanitizeInlineHtml(html: string) {
  return sanitize(html, INLINE_HTML);
}
