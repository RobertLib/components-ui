import { RichTextEditor, type RichTextToolbarItem } from "components-ui";

const TOOLBAR: RichTextToolbarItem[] = [
  "undo",
  "redo",
  "|",
  "bold",
  "italic",
  "link",
  "|",
  "image",
];

// A small bar chart - a data URL, so the example needs no server
const CHART =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPAAAACgCAIAAAC9uXYyAAACJ0lEQVR42u3SQRGAMAxFwfjCXTXgABO46i1XWhVA2p15Av4kGz0faZnCCQS0BLQEtAS0gJaAloCWgJaAFtAS0BLQEtAS0AJamh0tXwhoAQ20gBbQQAtooAU00AIaaAEtoIEW0EALaKAFNNACWkADLaCBFtBAC2igBbSABlpAAy2ggRbQPiegBTTQAhpoAQ20gJaAFtBAC2igd3uMuwENtLsBDTTQHgM00B7jbkAD7W5AAw000EAD7TFAA+0x7gY00O4GNNBAAw000B4DNNAe425AA+1uQAMNtMcADbTHuBvQHuNuQK/1GNuAhsY2oKEBGmiggQbaNqCBtg1oaIAGGhqggQYaaKBtAxpo24CGBmigoQEaaKCBBto2oIG2DWhogAYaGqCBBhpooG2rBtpjbAPaY2wD2jbbgLYNaI+xDWiPsQ1oaGwD2jaggbYNaI+xDWiPsQ1oaGwD2jaggbYNaI+xDWiPsQ1oaGwD2jaggbYNaI+xDWiPsQ1oaGwD2jaggbYNaI+xDWiPsQ1oaGwD2jaggbYNaI+xDWiPsQ1oaGwD2jaggbYNaI+xDWiPsQ1o22wD2jagPcY2oD3GNqChsQ1o24AG2jagPcY2oD3GNqChsQ1o24AG2jagPcY2oD3GNqChsQ1o24AG2jagPcY2oD3GNqChsQ1o24AG2jagPcY2oD3Gtv+APq9b+jygBbRUOaAFtAS0BLQEtICWgJaAloCWgBbQUvEGd3OEiJa4ewAAAAAASUVORK5CYII=";

/** Waits a moment, like a request would - or stops when it is aborted. */
function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timeout);
      reject(signal.reason);
    });
  });
}

// A real app sends the file to its server and resolves with the URL of the
// stored image - here the file becomes a data URL after a moment. A PNG,
// JPEG, GIF, WebP or AVIF image; an SVG is refused as no safe source.
async function uploadImage(file: File, { signal }: { signal: AbortSignal }) {
  await delay(1500, signal);

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function Images() {
  return (
    <RichTextEditor
      allowImageDataUrls
      defaultValue={
        "<p>Paste a screenshot, drop an image file, or pick one with the image tool.</p>" +
        `<p><img src="${CHART}" alt="Sales by quarter - the fourth is the best" width="240" height="160"></p>`
      }
      description="Click an image, then the image tool, to change its alternative text."
      label="Post"
      toolbar={TOOLBAR}
      uploadImage={uploadImage}
    />
  );
}
