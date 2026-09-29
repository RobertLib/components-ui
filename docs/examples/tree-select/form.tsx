import { Button, TreeSelect, useSnackbar } from "components-ui";
import { categories } from "./categories";

export default function Form() {
  const { enqueueSnackbar } = useSnackbar();

  return (
    <form
      className="grid max-w-3xl gap-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        enqueueSnackbar(
          `category=${String(data.get("category"))}, tags=${data.getAll("tags").join(",")}, owner=${String(data.get("owner"))}`,
        );
      }}
    >
      <TreeSelect
        items={categories}
        label="Category"
        name="category"
        placeholder="Required"
        required
      />
      <TreeSelect
        defaultValue={["women", "men"]}
        items={categories}
        label="Tags"
        multiple
        name="tags"
      />
      <TreeSelect
        defaultValue="lighting"
        description="Read-only - submitted, but it cannot be changed."
        items={categories}
        label="Owner"
        name="owner"
        readOnly
      />
      <TreeSelect
        defaultValue="garden"
        description="Disabled - neither submitted nor validated."
        disabled
        items={categories}
        label="Archived in"
        name="archive"
      />
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit">Save</Button>
        <Button color="default" type="reset" variant="outline">
          Reset
        </Button>
      </div>
    </form>
  );
}
