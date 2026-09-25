import { describe, expect, it } from "vitest";
import sanitizeRichText, {
  sanitizeEditorContent,
  sanitizeInlineHtml,
  sanitizeRichTextLines,
  sanitizeRichTextParagraphs,
  type RichTextFormat,
} from "./sanitize-rich-text";

// The formats of the editor before tables, lists and headings
const BASIC: RichTextFormat[] = ["bold", "italic", "link"];

describe("sanitizeRichText", () => {
  it("keeps the editor's formatting and drops everything else", () => {
    expect(
      sanitizeRichText(
        '<p class="x" onclick="steal()">Hi <b>bold</b> <u>under</u>' +
          '<a href="javascript:steal()">bad</a> <a href="/ok">ok</a></p>' +
          "<script>steal()</script><img src=x onerror=steal()>",
      ),
    ).toBe('<p>Hi <b>bold</b> <u>under</u>bad <a href="/ok">ok</a></p>');
  });

  it("removes SVG and MathML together with their content", () => {
    expect(
      sanitizeRichText(
        "<p>Text</p><svg><style>.a{fill:red}</style><title>Icon</title>" +
          '<a href="https://example.com">x</a></svg><math><mi>x</mi></math>',
      ),
    ).toBe("<p>Text</p>");
  });

  it("drops raw text elements whose content would come back as markup", () => {
    expect(
      sanitizeRichText(
        '<p>a</p><noscript><p title="</noscript><img src=x onerror=steal()>"></noscript>' +
          "<noembed><img src=x onerror=steal()></noembed>" +
          "<xmp><img src=x onerror=steal()></xmp>" +
          "<noframes><img src=x onerror=steal()></noframes>",
      ),
    ).toBe("<p>a</p>");
  });

  it("keeps the content of a textarea as text only", () => {
    expect(
      sanitizeRichText("<textarea><img src=x onerror=steal()></textarea>"),
    ).toBe("&lt;img src=x onerror=steal()&gt;");
  });

  it("keeps the text of links whose scheme is hidden behind entities", () => {
    expect(
      sanitizeRichText(
        '<a href="&#106;avascript:steal()">a</a>' +
          '<a href="javascript&colon;steal()">b</a>' +
          '<a href="&#x6A;&#x61;vascript:steal()">c</a>' +
          '<a href=" &#14; javascript:steal()">d</a>' +
          '<a href="data:text/html,<script>steal()</script>">e</a>' +
          '<a href="mailto:a@example.com">f</a>',
      ),
    ).toBe('abcde<a href="mailto:a@example.com">f</a>');
  });

  it("keeps the text of links without an href", () => {
    expect(
      sanitizeRichText('<h2><a name="top">Title</a></h2><p><a>Text</a></p>'),
    ).toBe("<h2>Title</h2><p>Text</p>");
  });

  it("strips handlers, styles, ids and names", () => {
    expect(
      sanitizeRichText(
        '<p id="app" name="x" style="position:fixed" onmouseover="steal()" ' +
          'ONCLICK="steal()" data-x="1">Hi <a href="/ok" target="_blank" ' +
          'id="login" name="login" onfocus="steal()">ok</a></p>',
      ),
    ).toBe('<p>Hi <a href="/ok">ok</a></p>');
  });

  it("does not bring back the is attribute of customized built-ins", () => {
    const html = sanitizeRichText(
      '<p is="x-evil">Hi <a is="x-link" href="https://example.com">ok</a></p>',
    );

    expect(html).toBe('<p>Hi <a href="https://example.com">ok</a></p>');
    expect(html).not.toContain("is=");
  });

  it("keeps its own content as it is", () => {
    const html =
      '<p>Hi <b>bold</b> <i>italic</i> <a href="https://example.com">link</a></p>' +
      "<div>line<br></div><div><br></div>" +
      "<h2>Plan</h2><h3>Steps</h3>" +
      "<ul><li>One<ol><li>Nested</li></ol></li><li><br></li></ul>" +
      "<blockquote><p>Quoted</p><p><br></p></blockquote>" +
      "<p><u>under</u> <s>struck</s> <code>npm test</code> <strong>s</strong> <em>e</em></p>" +
      "<hr>" +
      "<table><thead><tr><th>Name</th><th><br></th></tr></thead>" +
      "<tbody><tr><td>Jana<br>Nováková</td><td><b>32</b></td></tr></tbody></table>";

    expect(sanitizeRichText(html)).toBe(html);
  });

  it("unwraps a link inside a link, so the output parses the same", () => {
    // The parser nests the second link inside the first across the table
    const html = '<a href="/x"><table><td><a href="/y">inner</a></table>';
    const sanitized = sanitizeRichText(html);

    expect(sanitized).toBe(
      '<table><tbody><tr><td><a href="/x">inner</a></td></tr></tbody></table>',
    );
    expect(sanitizeRichText(sanitized)).toBe(sanitized);
    expect(sanitizeRichText(html, { formats: BASIC })).toBe(
      '<p><a href="/x">inner</a></p>',
    );
    expect(sanitizeInlineHtml(html)).toBe('<a href="/x">inner</a>');
  });

  it("gives the marks of other elements the editor's elements", () => {
    expect(
      sanitizeRichText(
        "<p><strike>a</strike> <del>b</del> <kbd>Ctrl</kbd> <tt>c</tt> <samp>d</samp></p>",
      ),
    ).toBe(
      "<p><s>a</s> <s>b</s> <code>Ctrl</code> <code>c</code> <code>d</code></p>",
    );
  });

  it("marks nothing twice and nothing bold in headings", () => {
    expect(
      sanitizeRichText(
        "<p><b>a <strong>b</strong></b> <i><em>c</em></i></p>" +
          "<h2><b>Title</b></h2>" +
          "<table><tr><th><b>Name</b></th></tr></table>",
      ),
    ).toBe(
      "<p><b>a b</b> <i>c</i></p><h2>Title</h2>" +
        "<table><thead><tr><th>Name</th></tr></thead></table>",
    );

    // Also where the bold is around them
    const html = sanitizeRichText(
      '<strong><h3>Title</h3><p>Text</p></strong><span style="font-weight:700">' +
        "<table><tr><th>Name</th><td>Jana</td></tr></table></span>",
    );
    expect(html).toBe(
      "<h3>Title</h3><p><strong>Text</strong></p>" +
        "<table><tbody><tr><th>Name</th><td><b>Jana</b></td></tr></tbody></table>",
    );
    expect(sanitizeRichText(html)).toBe(html);
  });

  it("keeps the spaces of the text, not the whitespace around blocks", () => {
    // Pasted into a line, the space before "world" is one
    expect(sanitizeRichText('<span> </span><b style="">world</b>')).toBe(
      " <b>world</b>",
    );
    expect(sanitizeRichText("\n<p>a</p>\n  <p>b</p>\n")).toBe(
      "<p>a</p><p>b</p>",
    );
    expect(sanitizeRichText(" <b>world</b>")).toBe(" <b>world</b>");
  });

  it("puts a mark around blocks into their lines", () => {
    expect(
      sanitizeRichText(
        '<b><p>One</p><p>Two</p></b><a href="/x"><ul><li>Item</li></ul></a>',
      ),
    ).toBe(
      '<p><b>One</b></p><p><b>Two</b></p><ul><li><a href="/x">Item</a></li></ul>',
    );
  });
});

describe("sanitizeRichText of pasted content", () => {
  it("keeps headings, the others as the closest heading of the editor", () => {
    expect(
      sanitizeRichText(
        "<h1>Title</h1><h2>Sub</h2><h4>Detail</h4><h6>Small</h6>Body",
      ),
    ).toBe("<h2>Title</h2><h2>Sub</h2><h3>Detail</h3><h3>Small</h3>Body");
  });

  it("keeps lists and moves a list right in a list into the item before", () => {
    expect(
      sanitizeRichText(
        "<ul>\n  <li>One</li>\n  <li>Two<ol><li>Nested</li></ol></li>\n</ul>",
      ),
    ).toBe("<ul><li>One</li><li>Two<ol><li>Nested</li></ol></li></ul>");

    // Chrome indents a list item so
    expect(
      sanitizeRichText("<ul><li>One</li><ul><li>Nested</li></ul></ul>"),
    ).toBe("<ul><li>One<ul><li>Nested</li></ul></li></ul>");

    // Text right in a list, a menu
    expect(
      sanitizeRichText("<ul>Loose<li>Item</li></ul><menu><li>A</li></menu>"),
    ).toBe("<ul><li>Loose</li><li>Item</li></ul><ul><li>A</li></ul>");
  });

  it("makes the paragraphs of a list item its lines", () => {
    expect(
      sanitizeRichText(
        "<ol><li><p>First</p><p>Second</p><ul><li><h3>Deep</h3></li></ul></li></ol>",
      ),
    ).toBe("<ol><li>First<br>Second<ul><li>Deep</li></ul></li></ol>");
  });

  it("keeps quotes of paragraphs", () => {
    expect(
      sanitizeRichText(
        "<blockquote>Loose text<p>Para</p>" +
          "<blockquote><p>Nested quote</p></blockquote>" +
          "<h2>Heading</h2><ul><li>Item</li></ul><hr></blockquote>",
      ),
    ).toBe(
      "<blockquote><p>Loose text</p><p>Para</p><p>Nested quote</p>" +
        "<p>Heading</p><p>Item</p><p><br></p></blockquote>",
    );
  });

  it("keeps tables with a header and a cell in every column", () => {
    expect(
      sanitizeRichText(
        "<table><caption>People</caption><thead><tr><th>Name</th><th>Age</th></tr></thead>" +
          "<tbody><tr><td>Jana</td><td>32</td></tr></tbody>" +
          "<tfoot><tr><td>Total</td><td>1</td></tr></tfoot></table>",
      ),
    ).toBe(
      "<p>People</p><table><thead><tr><th>Name</th><th>Age</th></tr></thead>" +
        "<tbody><tr><td>Jana</td><td>32</td></tr><tr><td>Total</td><td>1</td></tr></tbody></table>",
    );

    // A first row of header cells is the header
    expect(
      sanitizeRichText(
        "<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>",
      ),
    ).toBe(
      "<table><thead><tr><th>A</th><th>B</th></tr></thead>" +
        "<tbody><tr><td>1</td><td>2</td></tr></tbody></table>",
    );
  });

  it("splits merged cells and fills short rows", () => {
    expect(
      sanitizeRichText(
        '<table><tr><td colspan="2">Wide</td><td rowspan="2">Tall</td></tr>' +
          "<tr><td>a</td></tr><tr><td>b</td><td>c</td><td>d</td></tr></table>",
      ),
    ).toBe(
      "<table><tbody>" +
        "<tr><td>Wide</td><td></td><td>Tall</td></tr>" +
        "<tr><td>a</td><td></td><td></td></tr>" +
        "<tr><td>b</td><td>c</td><td>d</td></tr>" +
        "</tbody></table>",
    );
  });

  it("makes the blocks of a table cell its lines", () => {
    // Google Docs puts paragraphs into the cells
    expect(
      sanitizeRichText(
        "<table><tr>\n<td>\n<p>Name</p>\n</td><td><p>Street</p><p>City</p>Zip</td></tr></table>",
      ),
    ).toBe(
      "<table><tbody><tr><td>\nName\n</td><td>Street<br>City<br>Zip</td></tr></tbody></table>",
    );

    // A list or a table in a cell
    expect(
      sanitizeRichText(
        "<table><tr><td><ul><li>a</li><li>b</li></ul></td>" +
          "<td><table><tr><td>x</td><td>y</td></tr><tr><td>z</td></tr></table></td></tr></table>",
      ),
    ).toBe(
      "<table><tbody><tr><td>a<br>b</td><td>x\ty<br>z</td></tr></tbody></table>",
    );
  });

  it("keeps rules at the top level only", () => {
    expect(sanitizeRichText("Before<hr>After")).toBe("Before<hr>After");
    expect(sanitizeRichText("<ul><li>a<hr>b</li></ul>")).toBe(
      "<ul><li>a<br>b</li></ul>",
    );
  });

  it("keeps the lines of preformatted text", () => {
    expect(sanitizeRichText("<pre>npm install\nnpm test</pre>")).toBe(
      "<p>npm install<br>npm test</p>",
    );
    expect(sanitizeRichText("<pre><code>a\nb</code></pre>")).toBe(
      "<p><code>a<br>b</code></p>",
    );
  });

  it("reads the text styles of Google Docs", () => {
    expect(
      sanitizeRichText(
        '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1a2b">' +
          '<p dir="ltr" style="line-height:1.38;margin-top:0pt">' +
          '<span style="font-size:11pt;font-weight:400;font-style:normal;white-space:pre-wrap">Plain </span>' +
          '<span style="font-size:11pt;font-weight:700;font-style:normal">bold</span>' +
          '<span style="font-size:11pt;font-weight:400;font-style:italic"> italic</span>' +
          '<span style="text-decoration:underline;-webkit-text-decoration-skip:none"> under</span>' +
          '<span style="text-decoration:line-through"> struck</span>' +
          "<span style=\"font-family:'Courier New',monospace\"> code</span>" +
          '<a href="https://example.com"><span style="color:#1155cc;text-decoration:underline">link</span></a></p>' +
          "<br>" +
          '<ul><li dir="ltr" style="list-style-type:disc"><p dir="ltr">' +
          '<span style="font-weight:400">One</span></p></li></ul></b>',
      ),
    ).toBe(
      "<p>Plain <b>bold</b><i> italic</i><u> under</u><s> struck</s>" +
        '<code> code</code><a href="https://example.com">link</a></p>' +
        "<br><ul><li>One</li></ul>",
    );
  });

  it("makes lists of the list paragraphs of Word", () => {
    // Word writes the list and level into the style and the bullet or
    // number as text - here in a monospace font, as Word's "o" bullet is
    const item = (list: string, level: number, marker: string, text: string) =>
      `<p class=MsoListParagraphCxSpMiddle style='text-indent:-18.0pt;mso-list:${list} level${level} lfo1'>` +
      `<![if !supportLists]><span style='font-family:"Courier New"'><span style='mso-list:Ignore'>${marker}` +
      `<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp; </span></span></span><![endif]>` +
      `${text}<o:p></o:p></p>\n`;
    const html =
      item("l0", 1, "·", "First") +
      item("l0", 2, "o", "Nested") +
      item("l0", 3, "§", "Deep") +
      item("l0", 1, "·", "<b>Second</b>") +
      "<p class=MsoNormal>Between<o:p></o:p></p>\n" +
      item("l1", 1, "1.", "One") +
      item("l1", 2, "a)", "One a") +
      item("l1", 1, "2.", "Two");

    expect(sanitizeRichText(html)).toBe(
      "<ul><li>First<ul><li>Nested<ul><li>Deep</li></ul></li></ul></li>" +
        "<li><b>Second</b></li></ul><p>Between</p>" +
        "<ol><li>One<ol><li>One a</li></ol></li><li>Two</li></ol>",
    );
    // Without lists - the items as paragraphs, without the bullets
    expect(sanitizeRichText(html, { formats: BASIC })).toBe(
      "<p>First</p><p>Nested</p><p>Deep</p><p><b>Second</b></p>" +
        "<p>Between</p><p>One</p><p>One a</p><p>Two</p>",
    );
  });

  it("reads the text styles of other editors", () => {
    expect(
      sanitizeRichText(
        "<p class=MsoNormal><b><span style='font-size:12pt'>Bold</span></b>" +
          "<span style='font-style:italic'> it</span>" +
          "<span style='font-weight:bold;font-style:oblique'> both</span></p>" +
          '<h3 style="font-weight: 600">Heading</h3>' +
          '<strong style="font-weight: 400">not bold</strong>' +
          '<table><tr><td style="font-weight:700">Excel</td></tr></table>',
      ),
    ).toBe(
      "<p><b>Bold</b><i> it</i><i><b> both</b></i></p>" +
        "<h3>Heading</h3>not bold" +
        "<table><tbody><tr><td><b>Excel</b></td></tr></tbody></table>",
    );
  });

  it("keeps pasted blocks free of scripts and handlers", () => {
    expect(
      sanitizeRichText(
        '<ul><li onclick="steal()"><img src=x onerror="steal()">Item' +
          '<a href="javascript:steal()">bad</a></li></ul>' +
          '<table><tr><td style="background:url(https://evil.example/x)" colspan="1" class="x">' +
          "<script>steal()</script>Cell</td></tr></table>",
      ),
    ).toBe(
      "<ul><li>Itembad</li></ul>" +
        "<table><tbody><tr><td>Cell</td></tr></tbody></table>",
    );
  });

  it("gives the same output for its output", () => {
    const pasted =
      '<div><h1 style="color:red">Report</h1><section><p>Intro <span style="font-weight:bold">now</span></p>' +
      "<ul><li>A<ul><li>B</li></ul></li></ul><ol><li><p>x</p><p>y</p></li></ol></section>" +
      "<blockquote>Q<blockquote>R</blockquote></blockquote>" +
      '<table><tr><td rowspan="2">1</td><td>2</td></tr><tr><td>3</td></tr></table></div>';
    const once = sanitizeRichText(pasted);

    expect(sanitizeRichText(once)).toBe(once);
  });
});

describe("sanitizeRichText of hostile content", () => {
  const count = (html: string, tag: string) =>
    html.match(new RegExp(`<${tag}[ >]`, "g"))?.length ?? 0;

  it("keeps a table of huge spans from growing", () => {
    // 7 KB that would make 900,000 cells
    const html =
      "<table><tr>" +
      '<td colspan="50">a</td>'.repeat(60) +
      "</tr>" +
      "<tr><td>x</td></tr>".repeat(299) +
      "</table>";
    const sanitized = sanitizeRichText(html);

    // Too wide even without its spans - its rows are lines of text
    expect(count(sanitized, "td")).toBe(0);
    expect(count(sanitized, "p")).toBe(300);
    expect(sanitized.length).toBeLessThan(html.length);
  });

  it("leaves out the spans that would make a table too big", () => {
    expect(
      sanitizeRichText(
        '<table><tr><td colspan="60">Title</td></tr><tr><td>a</td><td>b</td></tr></table>',
      ),
    ).toBe(
      "<table><tbody><tr><td>Title</td><td></td></tr>" +
        "<tr><td>a</td><td>b</td></tr></tbody></table>",
    );

    // A cell spanning all the rows and many columns
    const tall = sanitizeRichText(
      '<table><tr><td rowspan="0" colspan="50">x</td></tr>' +
        "<tr><td>y</td></tr>".repeat(300) +
        "</table>",
    );
    expect(count(tall, "td")).toBe(301);
  });

  it("makes lines of the rows of a table with too many cells", () => {
    const sanitized = sanitizeRichText(
      `<table>${"<tr><td>a</td><td>b</td><td>c</td></tr>".repeat(3334)}</table>`,
    );

    expect(count(sanitized, "table")).toBe(0);
    expect(count(sanitized, "p")).toBe(3334);
    expect(sanitized.startsWith("<p>a\tb\tc</p>")).toBe(true);
  });

  it("copies deep nesting as its text instead of throwing", () => {
    const deep = `${"<span>".repeat(2000)}deep<script>steal()</script>`;

    expect(sanitizeRichText(deep)).toBe("deep");
    expect(sanitizeRichText(`${"<div>".repeat(2000)}deep`)).toBe("<p>deep</p>");
    expect(sanitizeRichText(`${"<ul><li>".repeat(300)}item`)).toContain("item");

    const inline = sanitizeInlineHtml(deep);
    expect(inline).toContain("deep");
    expect(inline).not.toContain("steal");
    expect(count(inline, "span")).toBeLessThanOrEqual(100);
  });

  it("copies blocks nested in a line in the time of a flat line", () => {
    // Copied level by level, the lines of paragraphs nested in a list item
    // or a cell were moved again at every level - seconds for 0.5 MB
    const lines = "x<br>".repeat(3_000);
    const time = (html: string) => {
      let best = Infinity;
      for (let round = 0; round < 2; round += 1) {
        const start = performance.now();
        sanitizeRichText(html);
        best = Math.min(best, performance.now() - start);
      }
      return best;
    };

    for (const line of ["<ul><li>", "<table><tr><td>"]) {
      const flat = time(line + lines);
      const nested = time(line + "<div>".repeat(95) + lines);
      expect(nested).toBeLessThan(flat * 5);
    }
    expect(
      count(sanitizeRichText(`<ul><li>${"<div>".repeat(95)}${lines}`), "br"),
    ).toBe(3_000);
  });

  it("copies long runs of nodes", () => {
    // 300,000 nodes - too many to be spread into the arguments of a call
    const sanitized = sanitizeRichText(`<pre>x${"\n".repeat(150_000)}</pre>`);
    expect(count(sanitized, "br")).toBe(150_000);
  });

  it("gives the same output for its output also for malformed tables", () => {
    // Without a doctype the parser would keep the table in the paragraph
    const html = '<p><a href="/x"><table><tr><td>x</td></tr></table></a></p>';

    for (const formats of [undefined, BASIC]) {
      const once = sanitizeRichText(html, { formats });
      expect(sanitizeRichText(once, { formats })).toBe(once);
      expect(once).not.toContain("<p></p>");
    }
    expect(sanitizeRichText(html)).toBe(
      "<table><tbody><tr><td>x</td></tr></tbody></table>",
    );
  });

  it("makes the blocks in the inline elements of a paragraph its lines", () => {
    expect(sanitizeRichText("<div><b><p>One</p><p>Two</p></b></div>")).toBe(
      "<p><b>One</b></p><p><b>Two</b></p>",
    );
    expect(
      sanitizeRichText(
        "<table><tr><td><span><h2>A</h2>b</span></td></tr></table>",
      ),
    ).toBe("<table><tbody><tr><td>A<br>b</td></tr></tbody></table>");
  });

  it("drops paragraphs that show nothing", () => {
    expect(
      sanitizeRichText(
        "<p></p><p> </p><div>\n</div><p><img src=x></p><p>&nbsp;</p><p><br></p>",
      ),
    ).toBe("<p>&nbsp;</p><p><br></p>");
  });
});

describe("sanitizeRichText of its output", () => {
  const TAGS = (
    "p div span b strong i em u s strike code kbd a h1 h2 h3 h4 h6 ul ol li " +
    "menu blockquote table thead tbody tfoot tr td th caption colgroup hr br " +
    "pre section header font mark small sub sup svg math mi mtext style title " +
    "textarea noscript template select option img"
  ).split(" ");
  const VOID = new Set(["br", "hr", "img"]);
  const STYLES = [
    "font-weight:700",
    "font-weight:normal",
    "font-style:italic",
    "text-decoration:underline",
    "text-decoration:line-through",
    "font-family:monospace",
    "mso-list:l0 level2 lfo1",
    "mso-list:Ignore",
  ];
  const TEXTS = ["x", " ", "\n", "&nbsp;", "a b", "&lt;b&gt;", "\t", "é"];
  const STRAY = ["</p>", "</td>", "</li>", "</a>", "</b>", "<!-- c -->"];

  /** Random HTML of the shapes of pasted content - the same for a seed. */
  function randomHtml(seed: number) {
    let state = seed;
    const random = () => {
      state = (state * 1_103_515_245 + 12_345) & 0x7fffffff;
      return state / 0x7fffffff;
    };
    const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];

    const content = (depth: number): string => {
      let html = "";
      for (let index = Math.floor(random() * 4); index >= 0; index -= 1) {
        if (depth > 4 || random() < 0.3) {
          html += pick(TEXTS);
        } else {
          const tag = pick(TAGS);
          let attributes = "";
          if (random() < 0.3) attributes += ` style="${pick(STYLES)}"`;
          if (tag === "a") attributes += ' href="/x"';
          if ((tag === "td" || tag === "th") && random() < 0.3) {
            attributes += ` colspan="2" rowspan="${Math.floor(random() * 3)}"`;
          }
          html += `<${tag}${attributes}>`;
          if (!VOID.has(tag)) {
            html += content(depth + 1);
            if (random() < 0.85) html += `</${tag}>`;
          }
        }
        if (random() < 0.05) html += pick(STRAY);
      }
      return html;
    };
    return content(0);
  }

  it("gives the same output again", () => {
    const formatSets = [
      undefined,
      BASIC,
      ["blockquote", "heading3", "numberedList", "code", "horizontalRule"],
    ] satisfies (RichTextFormat[] | undefined)[];

    for (let seed = 1; seed <= 50; seed += 1) {
      // Several fragments - each sanitizing has its cost of its own
      const html = [1, 2, 3, 4, 5]
        .map((part) => randomHtml(seed * 7 + part))
        .join("");

      for (const formats of formatSets) {
        const once = sanitizeRichText(html, { formats });
        expect(sanitizeRichText(once, { formats }), html).toBe(once);
      }
      const lines = sanitizeRichTextLines(html);
      expect(sanitizeRichTextLines(lines), html).toBe(lines);
      const inline = sanitizeInlineHtml(html);
      expect(sanitizeInlineHtml(inline), html).toBe(inline);
    }
  });
});

describe("sanitizeRichText with fewer formats", () => {
  it("turns headings and list items into paragraphs", () => {
    expect(
      sanitizeRichText("<h1>Title</h1><h2>Sub</h2>Body", { formats: BASIC }),
    ).toBe("<p>Title</p><p>Sub</p>Body");
    expect(
      sanitizeRichText(
        "<ul>\n  <li>One</li>\n  <li>Two<ol><li>Nested</li></ol></li>\n</ul>",
        { formats: BASIC },
      ),
    ).toBe("<p>One</p><p>Two</p><p>Nested</p>");
    expect(
      sanitizeRichText("<blockquote><p>First</p><p>Second</p></blockquote>", {
        formats: BASIC,
      }),
    ).toBe("<p>First</p><p>Second</p>");
  });

  it("puts every table row on a line of its own", () => {
    expect(
      sanitizeRichText(
        "<table><thead><tr><th>Name</th><th>Age</th></tr></thead>" +
          "<tbody><tr><td>Jana</td><td>32</td></tr></tbody></table>",
        { formats: BASIC },
      ),
    ).toBe("<p>Name\tAge</p><p>Jana\t32</p>");

    // Google Docs puts paragraphs into the cells
    expect(
      sanitizeRichText(
        "<table><tr>\n<td>\n<p>Name</p>\n</td><td><p>Street</p><p>City</p>Zip</td></tr></table>",
        { formats: BASIC },
      ),
    ).toBe("<p>\nName\n\tStreet<br>City<br>Zip</p>");
  });

  it("keeps rules as line breaks and drops other marks", () => {
    expect(
      sanitizeRichText(
        'Before<hr>After <u>u</u> <s>s</s> <code>c</code> <b>b</b> <a href="/x">x</a>',
        { formats: ["bold"] },
      ),
    ).toBe("Before<br>After u s c <b>b</b> x");
  });

  it("keeps a heading or list of the kind that is kept", () => {
    expect(
      sanitizeRichText("<h2>Two</h2><h3>Three</h3>", {
        formats: ["heading3"],
      }),
    ).toBe("<h3>Two</h3><h3>Three</h3>");
    expect(
      sanitizeRichText("<ul><li>a</li></ul><ol><li>b</li></ol>", {
        formats: ["numberedList"],
      }),
    ).toBe("<ol><li>a</li></ol><ol><li>b</li></ol>");
  });

  it("reads bold and italic only where they are kept", () => {
    expect(
      sanitizeRichText(
        '<span style="font-weight:700;font-style:italic;text-decoration:underline">x</span>' +
          '<h3 style="font-weight: 600">Heading</h3>',
        { formats: ["italic", "bold"] },
      ),
    ).toBe("<i><b>x</b></i><p><b>Heading</b></p>");
  });
});

describe("sanitizeRichTextLines", () => {
  it("makes the blocks lines of text", () => {
    expect(
      sanitizeRichTextLines(
        "<h2>Title</h2><p>One</p><ul><li>Two</li><li>Three</li></ul>" +
          "<table><tr><td>a</td><td>b</td></tr></table>",
      ),
    ).toBe("Title<br>One<br>Two<br>Three<br>a\tb");
  });
});

describe("sanitizeRichTextParagraphs", () => {
  it("makes the blocks paragraphs, the text around them too", () => {
    expect(
      sanitizeRichTextParagraphs(
        "Intro <b>now</b><h2>Title</h2><ul><li>One</li><li>Two</li></ul>" +
          "<blockquote><p>Quoted</p></blockquote><table><tr><td>a</td><td>b</td></tr></table>",
      ),
    ).toBe(
      "<p>Intro <b>now</b></p><p>Title</p><p>One</p><p>Two</p><p>Quoted</p><p>a\tb</p>",
    );
  });
});

describe("sanitizeEditorContent", () => {
  it("leaves out the styles the browser's editing puts into the content", () => {
    // What Chrome leaves of a heading merged into the paragraph before it
    expect(
      sanitizeEditorContent(
        '<p>para<span style="font-size: 1.3em; font-weight: 600;">Head</span>' +
          '<span style="font-style: italic; font-family: monospace">!</span></p>',
        ["bold", "italic", "code"],
      ),
    ).toEqual({ hasText: true, html: "<p>paraHead!</p>" });
    // Pasted content keeps them as marks
    expect(
      sanitizeRichText(
        '<p>para<span style="font-weight: 600;">Head</span></p>',
      ),
    ).toBe("<p>para<b>Head</b></p>");
  });

  it("tells content without text", () => {
    expect(
      sanitizeEditorContent("<p><br></p><hr>", ["horizontalRule"]),
    ).toEqual({ hasText: false, html: "<p><br></p><hr>" });
    expect(sanitizeEditorContent("", [])).toEqual({ hasText: false, html: "" });
  });
});

describe("sanitizeInlineHtml", () => {
  it("keeps inline formatting with classes, without scripts or styles", () => {
    expect(
      sanitizeInlineHtml(
        '<span class="font-bold" style="color:red" onmouseover="steal()">Team</span>' +
          ' <small>(3)</small><div>block</div><img src=x onerror="steal()">',
      ),
    ).toBe('<span class="font-bold">Team</span> <small>(3)</small>block');
  });

  it("keeps only classes that style text in place, and none on links", () => {
    expect(
      sanitizeInlineHtml(
        '<a class="fixed inset-0 z-50 opacity-0" href="https://example.com">Win</a>' +
          '<span class="fixed inset-0 z-50 -translate-x-4 w-screen">Over</span>' +
          '<b class="text-danger-600 dark:text-danger-400 hover:underline font-bold! ' +
          'bg-[url(https://evil.example/x.png)] text-[100vh] rounded px-1">Team</b>',
      ),
    ).toBe(
      '<a href="https://example.com">Win</a><span>Over</span>' +
        '<b class="text-danger-600 dark:text-danger-400 hover:underline font-bold! rounded px-1">Team</b>',
    );
  });

  it("drops variants that style other elements and large sizes", () => {
    expect(
      sanitizeInlineHtml(
        '<span class="*:py-96 [&_a]:text-transparent has-[a]:px-96 before:px-2 ' +
          "group-hover:underline py-9999 px-96 border-999 border-x-999 " +
          'underline-offset-999 decoration-999 leading-96 -px-2">A</span>' +
          '<span class="dark:hover:text-danger-300 focus:underline border-2 ' +
          'border-t border-danger-500 border-dashed rounded-md px-2 py-0.5">B</span>',
      ),
    ).toBe(
      "<span>A</span>" +
        '<span class="dark:hover:text-danger-300 focus:underline border-2 ' +
        'border-t border-danger-500 border-dashed rounded-md px-2 py-0.5">B</span>',
    );
  });

  it("keeps the text of links without a safe href", () => {
    expect(
      sanitizeInlineHtml(
        '<a href="javascript:steal()">bad</a> <a name="top">anchor</a> ' +
          '<a href="https://example.com">ok</a>',
      ),
    ).toBe('bad anchor <a href="https://example.com">ok</a>');
  });

  it("keeps no is attribute and no blocks", () => {
    expect(
      sanitizeInlineHtml(
        '<span is="x-evil" class="font-bold">A</span><ul><li>B</li></ul>',
      ),
    ).toBe('<span class="font-bold">A</span>B');
  });
});
