import { FileUpload } from "components-ui";

/** The size of a picked image - read in the browser, nothing uploaded. */
function imageSize(file: File) {
  return new Promise<{ height: number; width: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ height: image.naturalHeight, width: image.naturalWidth });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`The browser cannot show ${file.name}`));
    };
    image.src = url;
  });
}

// Take a screenshot, focus the upload button and paste it (⌘V / Ctrl+V)
export default function Validation() {
  return (
    <FileUpload
      accept="image/*"
      description="Screenshots of at least 400 × 300 px - paste one while the field has the focus."
      label="Screenshots"
      maxFileSize={5}
      multiple
      name="screenshots"
      preview
      validate={async (file) => {
        const { height, width } = await imageSize(file);
        if (width < 400 || height < 300) {
          return `The image has ${width} × ${height} px - it needs at least 400 × 300 px.`;
        }
      }}
    />
  );
}
