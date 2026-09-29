import { useState } from "react";
import { FileUpload } from "components-ui";

// The picker picks a folder - the list shows the path of each of its files
export default function Folder() {
  const [total, setTotal] = useState(0);

  return (
    <FileUpload
      description={`${(total / 1024 / 1024).toFixed(1)} MB picked`}
      directory
      label="Photos of the event"
      multiple
      name="photos"
      onFilesChange={(files) =>
        setTotal(files.reduce((sum, file) => sum + file.size, 0))
      }
      variant="button"
    />
  );
}
