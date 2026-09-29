// Random malformed HTML for the tests of `sanitizeRichText` - in the
// browser's DOM and on a server with only jsdom's DOMParser. Whatever comes
// in, the output holds only the allowed elements and attributes, and its
// output is the same again.
import sanitizeRichText, {
  isSafeHref,
  isSafeImageSrc,
  sanitizeEditorContent,
  sanitizeInlineHtml,
  sanitizeRichTextLines,
  sanitizeRichTextParagraphs,
  type RichTextFormat,
} from "../utils/sanitize-rich-text";

const RICH_TAGS = new Set(
  "P DIV H2 H3 UL OL LI BLOCKQUOTE TABLE THEAD TBODY TR TD TH HR BR B STRONG I EM U S CODE A".split(
    " ",
  ),
);
const INLINE_TAGS = new Set(
  "A B BR EM I MARK S SMALL SPAN STRONG SUB SUP U".split(" "),
);

const TAGS = (
  "p div b i u s a ul ol li table tr td th thead tbody tfoot caption h1 h2 " +
  "h4 blockquote hr br pre span code strong em del kbd font listing menu " +
  "col colgroup dl dt dd section form button select option textarea img " +
  "input svg math mi mtext mglyph foreignObject desc annotation-xml " +
  "template noscript style title xmp iframe object picture source figure " +
  "figcaption image video img img img"
).split(" ");
const ATTRIBUTES = [
  "",
  ' href="https://example.com/"',
  ' href="javascript:steal()"',
  ' href=" java\tscript:steal()"',
  ' href="&#106;avascript:steal()"',
  ' href="data:text/html,x"',
  ' xlink:href="javascript:steal()"',
  ' formaction="javascript:steal()"',
  ' srcset="javascript:steal()"',
  ' src=x onerror="steal()"',
  ' onclick="steal()"',
  ' class="text-red-500 fixed"',
  ' style="font-weight:700"',
  ' style="font-style:italic"',
  ' style="text-decoration:underline"',
  ' style="font-family:monospace"',
  ' style="mso-list:l1 level1 lfo1"',
  ' style="mso-list:Ignore"',
  ' colspan="3"',
  ' rowspan="0"',
];
// The attributes of images - safe and unsafe sources, sizes and others
const IMAGE_ATTRIBUTES = [
  "",
  ' src="https://example.com/a.png" alt="A" title="T"',
  ' src="/a.png" width="120" height="80"',
  ' src="//example.com/a.png" width="100%" height="-1"',
  ' src="javascript:steal()"',
  ' src=" java\tscript:steal()"',
  ' src="&#106;avascript:steal()"',
  ' src="data:text/html,<script>steal()</script>"',
  ' src="data:image/svg+xml,<svg onload=steal()>"',
  ' src="data:image/svg+xml;base64,PHN2Zz4="',
  ' src="data:image/png;base64,iVBORw0KGgo="',
  ' src="blob:https://example.com/1"',
  ' src="file:///etc/passwd"',
  ' src="" alt="empty"',
  ' src="/a.png" srcset="javascript:steal() 2x" sizes="100vw"',
  ' src="/a.png" style="position:fixed;inset:0" usemap="#m" ismap',
  ' src="/a.png" alt="&quot;&gt;&lt;img src=x onerror=steal()&gt;"',
  ' src="/a.png" onload="steal()" loading="lazy" crossorigin',
  ' href="https://example.com/a.png" xlink:href="javascript:steal()"',
  ' src=x onerror="steal()"',
  ' src="/a.png" alt="1.\n</p><p>2."',
];
const TEXTS = [
  "x",
  " ",
  "\n",
  "a b",
  "&lt;img src=x onerror=steal()&gt;",
  "&amp;",
  "&nbsp;",
  "1.",
  "</p>",
  "<!--<img src=x onerror=steal()>-->",
  "<![CDATA[x]]>",
  "</pre>",
  "```",
];

const EVERY_FORMAT: RichTextFormat[] = [
  "blockquote",
  "bold",
  "bulletList",
  "code",
  "codeBlock",
  "heading2",
  "heading3",
  "horizontalRule",
  "image",
  "italic",
  "link",
  "numberedList",
  "strikethrough",
  "table",
  "underline",
];
const FORMATS: (RichTextFormat[] | undefined)[] = [
  undefined,
  ["bold", "italic", "link"],
  ["bulletList", "link", "bold"],
  ["table", "code", "link"],
  ["heading3", "blockquote", "underline", "strikethrough"],
  [],
  EVERY_FORMAT,
  ["image", "link", "codeBlock"],
  ["image", "bulletList", "table", "bold"],
  ["image", "blockquote", "heading2", "code"],
];

/** A random number generator of a seed - the same HTML for the same seed. */
function random(seed: number) {
  let state = seed;
  return (count: number) => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return Math.floor((state / 0x7fffffff) * count);
  };
}

function randomHtml(pick: (count: number) => number, depth = 0): string {
  let html = "";
  for (let index = pick(4); index > 0; index -= 1) {
    if (depth > 6 || pick(10) < 3) {
      html += TEXTS[pick(TEXTS.length)];
      continue;
    }
    const tag = TAGS[pick(TAGS.length)];
    // Images mostly with the attributes of images
    const attributes =
      /^(img|image|source|video)$/.test(tag) && pick(10) < 8
        ? IMAGE_ATTRIBUTES
        : ATTRIBUTES;
    html += `<${tag}${attributes[pick(attributes.length)]}>`;
    html += randomHtml(pick, depth + 1);
    // Some are left open
    if (pick(10) < 8) html += `</${tag}>`;
  }
  return html;
}

/** What an output may hold - its elements, and the rules of images. */
interface Allowed {
  /** Images may load from `data:` URLs of raster images. */
  dataUrls: boolean;
  /** Attributes of any element - the classes of inline HTML. */
  attributes: ReadonlySet<string>;
  tags: ReadonlySet<string>;
}

const IMAGE_SIZE = /^[1-9]\d{0,4}$/;

/** Whether an attribute of an element is one the output may keep. */
function isAllowedAttribute(
  element: Element,
  name: string,
  value: string,
  allowed: Allowed,
) {
  if (allowed.attributes.has(name)) return true;
  if (element.tagName === "A") return name === "href" && isSafeHref(value);
  if (element.tagName !== "IMG") return false;

  if (name === "src") return isSafeImageSrc(value, allowed.dataUrls);
  if (name === "width" || name === "height") return IMAGE_SIZE.test(value);
  return name === "alt" || name === "title";
}

/** Why the output is unsafe - `null` when it is not. */
function unsafeMarkup(html: string, allowed: Allowed) {
  const { body } = new DOMParser().parseFromString(
    `<!DOCTYPE html><body>${html}`,
    "text/html",
  );
  for (const element of Array.from(body.getElementsByTagName("*"))) {
    if (!allowed.tags.has(element.tagName)) return `<${element.tagName}>`;
    // An image without a source is none - it would only show as broken
    if (element.tagName === "IMG" && !element.hasAttribute("src")) {
      return "<IMG> without src";
    }
    // A code block holds plain text in a `<code>` - lines and nothing else
    const code = element.firstElementChild;
    if (
      element.tagName === "PRE" &&
      (element.childNodes.length !== 1 ||
        code?.tagName !== "CODE" ||
        Array.from(code.getElementsByTagName("*")).some(
          (child) => child.tagName !== "BR",
        ))
    ) {
      return `a code block of ${element.innerHTML}`;
    }
    for (const { name, value } of Array.from(element.attributes)) {
      if (!isAllowedAttribute(element, name, value, allowed)) {
        return `${name}="${value}"`;
      }
    }
  }
  return null;
}

/** The elements the output of `formats` may hold. */
function richTags(formats: readonly RichTextFormat[] | undefined) {
  const tags = new Set(RICH_TAGS);
  // Code blocks by default, images only where they are asked for
  if (!formats || formats.includes("codeBlock")) tags.add("PRE");
  if (formats?.includes("image")) tags.add("IMG");
  return tags;
}

/**
 * Sanitizes the random HTML of `seeds` seeds in every way - the problems
 * found, empty when there are none.
 */
export function fuzzSanitizer(seeds: number) {
  const problems: string[] = [];
  const noAttributes = new Set<string>();

  for (let seed = 1; seed <= seeds; seed += 1) {
    const html = randomHtml(random(seed));
    const formats = FORMATS[seed % FORMATS.length];
    // Every other seed lets images load from `data:` URLs
    const dataUrls = seed % 2 === 0;
    const rich: Allowed = {
      attributes: noAttributes,
      dataUrls,
      tags: richTags(formats),
    };
    const editorFormats = formats ?? EVERY_FORMAT;
    const sanitizers: [string, (input: string) => string, Allowed][] = [
      [
        "flow",
        (input) =>
          sanitizeRichText(input, { allowImageDataUrls: dataUrls, formats }),
        rich,
      ],
      [
        "lines",
        (input) => sanitizeRichTextLines(input, formats, dataUrls),
        rich,
      ],
      [
        "paragraphs",
        (input) => sanitizeRichTextParagraphs(input, formats, dataUrls),
        rich,
      ],
      [
        "editor",
        (input) =>
          sanitizeEditorContent(input, editorFormats, false, dataUrls).html,
        { ...rich, tags: richTags(editorFormats) },
      ],
      [
        "inline",
        sanitizeInlineHtml,
        { attributes: new Set(["class"]), dataUrls: false, tags: INLINE_TAGS },
      ],
    ];

    for (const [name, sanitize, allowed] of sanitizers) {
      const once = sanitize(html);
      const unsafe = unsafeMarkup(once, allowed);
      if (unsafe) problems.push(`${name} of ${html} keeps ${unsafe}`);
      if (sanitize(once) !== once) {
        problems.push(`${name} of ${html} changes again: ${once}`);
      }
    }
  }
  return problems;
}
