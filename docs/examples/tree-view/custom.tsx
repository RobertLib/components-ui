import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  Chip,
  IconButton,
  TreeView,
  useSnackbar,
  type TreeItem,
} from "components-ui";

interface Category extends TreeItem<number> {
  children?: Category[];
  products: number;
}

const initialCategories: Category[] = [
  {
    children: [
      { id: 2, label: "Laptops", products: 48 },
      { id: 3, label: "Monitors", products: 31 },
      { id: 4, label: "Accessories", products: 0 },
      { id: 5, label: "Cables", products: 0 },
    ],
    id: 1,
    label: "Computers",
    products: 79,
  },
  {
    children: [
      { id: 7, label: "Chairs", products: 12 },
      { id: 8, label: "Desks", products: 9 },
      { id: 9, label: "Lamps", products: 0 },
    ],
    id: 6,
    label: "Office furniture",
    products: 21,
  },
];

/** `categories` without the category `id`. */
const without = (categories: Category[], id: number): Category[] =>
  categories
    .filter((category) => category.id !== id)
    .map((category) =>
      category.children
        ? { ...category, children: without(category.children, id) }
        : category,
    );

export default function Custom() {
  const { enqueueSnackbar } = useSnackbar();
  const [categories, setCategories] = useState(initialCategories);

  return (
    <TreeView
      aria-label="Categories"
      className="max-w-md"
      defaultExpanded={[1, 6]}
      items={categories}
      renderActions={(category) => (
        <>
          <IconButton
            aria-label={`Add a subcategory to ${category.label}`}
            onClick={() =>
              enqueueSnackbar(`New subcategory of ${category.label}`)
            }
          >
            <Plus size={16} />
          </IconButton>
          <IconButton
            aria-label={`Rename ${category.label}`}
            onClick={() => enqueueSnackbar(`Renaming ${category.label}`)}
          >
            <Pencil size={16} />
          </IconButton>
          {/* Only an empty category can be deleted */}
          <IconButton
            aria-label={`Delete ${category.label}`}
            disabled={category.products > 0}
            onClick={() => {
              setCategories((current) => without(current, category.id));
              enqueueSnackbar(`Deleted ${category.label}`);
            }}
            variant="danger"
          >
            <Trash2 size={16} />
          </IconButton>
        </>
      )}
      renderLabel={(category, { label }) => (
        <span className="flex items-center gap-2">
          {label}
          <Chip color={category.products ? "primary" : "secondary"}>
            {category.products}
          </Chip>
        </span>
      )}
    />
  );
}
