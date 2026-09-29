import { afterEach, describe, expect, it } from "vitest";
import { imageAt, insertInline, toImageSrc } from "./images";

afterEach(() => {
  document.body.innerHTML = "";
});

function createEditor(html: string) {
  const editor = document.createElement("div");
  editor.innerHTML = html;
  document.body.append(editor);
  return editor;
}

const imageElement = (document: Document) => {
  const image = document.createElement("img");
  image.setAttribute("src", "/a.png");
  return image;
};

describe("toImageSrc", () => {
  it("gives an address of a host https:// and keeps paths relative", () => {
    expect(toImageSrc("cdn.example.com/a.png")).toBe(
      "https://cdn.example.com/a.png",
    );
    expect(toImageSrc("localhost:3000/a.png")).toBe(
      "https://localhost:3000/a.png",
    );
    expect(toImageSrc("https://example.com/a.png")).toBe(
      "https://example.com/a.png",
    );
    expect(toImageSrc("/uploads/a.png")).toBe("/uploads/a.png");
    expect(toImageSrc("../a.png")).toBe("../a.png");
    expect(toImageSrc("images/a.png")).toBe("images/a.png");
    expect(toImageSrc("a.png")).toBe("a.png");
    expect(toImageSrc("javascript:alert(1)")).toBe("javascript:alert(1)");
  });
});

describe("insertInline", () => {
  it("puts an image at the caret, the caret after it", () => {
    const editor = createEditor("<p>ab</p>");
    const range = document.createRange();
    range.setStart(editor.querySelector("p")?.firstChild as Node, 1);

    const caret = insertInline(editor, range, imageElement(document));
    expect(editor.innerHTML).toBe('<p>a<img src="/a.png">b</p>');
    expect(caret.startContainer).toBe(editor.firstChild);
    expect(caret.startOffset).toBe(2);
  });

  it("replaces the selection and the line break of an empty line", () => {
    const editor = createEditor("<p>abc</p><p><br></p>");
    const text = editor.querySelector("p")?.firstChild as Node;
    const range = document.createRange();
    range.setStart(text, 1);
    range.setEnd(text, 2);

    insertInline(editor, range, imageElement(document));
    expect(editor.innerHTML).toBe('<p>a<img src="/a.png">c</p><p><br></p>');

    const empty = document.createRange();
    empty.setStart(editor.lastChild as Node, 0);
    insertInline(editor, empty, imageElement(document));
    expect(editor.innerHTML).toBe(
      '<p>a<img src="/a.png">c</p><p><img src="/a.png"></p>',
    );
  });

  it("gives an image between blocks a paragraph", () => {
    const editor = createEditor("<p>a</p><hr>");
    const range = document.createRange();
    range.setStart(editor, 2);

    insertInline(editor, range, imageElement(document));
    expect(editor.innerHTML).toBe('<p>a</p><hr><p><img src="/a.png"></p>');
  });
});

describe("imageAt", () => {
  it("tells a selection of one image and no text", () => {
    const editor = createEditor(
      '<p>a<img src="/a.png"><img src="/b.png" data-upload="1">b</p>',
    );
    const [first, uploading] = Array.from(editor.querySelectorAll("img"));
    const range = document.createRange();

    range.selectNode(first);
    expect(imageAt(editor, range)).toBe(first);
    // Not a placeholder of an upload
    range.selectNode(uploading);
    expect(imageAt(editor, range)).toBeNull();
    // Nor text, or a caret
    range.selectNodeContents(editor);
    expect(imageAt(editor, range)).toBeNull();
    range.collapse(true);
    expect(imageAt(editor, range)).toBeNull();
  });
});
