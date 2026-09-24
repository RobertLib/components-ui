import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FileUpload from "./file-upload";
import RadioGroup from "./radio-group";
import RichTextEditor from "./rich-text-editor";

const sizes = [
  { label: "Small", value: "s" },
  { label: "Large", value: "l" },
];

describe("Fields outside their form", () => {
  it("submit and reset with the form of their `form` attribute", () => {
    render(
      <>
        <form id="order" />
        <RadioGroup defaultValue="s" form="order" name="size" options={sizes} />
        <RichTextEditor
          defaultValue="<p>Hello</p>"
          form="order"
          label="Note"
          name="note"
        />
        <FileUpload
          defaultAttachments={[{ filename: "a.pdf", id: "1", value: "file-1" }]}
          form="order"
          name="files"
          upload={async () => ({})}
        />
      </>,
    );
    const form = document.getElementById("order") as HTMLFormElement;

    fireEvent.click(screen.getByRole("radio", { name: "Large" }));
    const data = new FormData(form);
    expect(data.get("size")).toBe("l");
    expect(data.get("note")).toBe("<p>Hello</p>");
    expect(data.getAll("files")).toEqual(["file-1"]);

    fireEvent.reset(form);
    expect(screen.getByRole("radio", { name: "Small" })).toBeChecked();
  });

  it("leave the generated name of a RadioGroup out of the data of that form", () => {
    render(
      <>
        {/* Inside one form, of another */}
        <form aria-label="Cart">
          <RadioGroup
            defaultValue="l"
            form="order"
            label="Size"
            options={sizes}
          />
        </form>
        <form aria-label="Order" id="order" />
      </>,
    );

    // jsdom builds a FormData without firing the event browsers fire
    for (const name of ["Order", "Cart"]) {
      const form = screen.getByRole<HTMLFormElement>("form", { name });
      const formData = new FormData(form);
      form.dispatchEvent(Object.assign(new Event("formdata"), { formData }));
      expect([...formData.entries()]).toEqual([]);
    }
  });
});

describe("RichTextEditor ids", () => {
  it("derives the ids of its messages from its id", () => {
    render(
      <RichTextEditor
        description="Visible to the team."
        error="Too short"
        id="note"
        label="Note"
      />,
    );

    expect(document.getElementById("note-description")).toHaveTextContent(
      "Visible to the team.",
    );
    expect(document.getElementById("note-error")).toHaveTextContent(
      "Too short",
    );
  });
});
