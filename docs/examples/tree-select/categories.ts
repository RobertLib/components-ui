import type { TreeItem } from "components-ui";

/** The product categories shared by the TreeSelect examples. */
export const categories: TreeItem<string>[] = [
  {
    children: [
      {
        children: [
          { id: "laptops", label: "Laptops" },
          { id: "desktops", label: "Desktops" },
          { id: "monitors", label: "Monitors" },
        ],
        id: "computers",
        label: "Computers",
      },
      {
        children: [
          { id: "smartphones", label: "Smartphones" },
          { id: "cases", label: "Cases & covers" },
        ],
        id: "phones",
        label: "Phones",
      },
      { disabled: true, id: "cameras", label: "Cameras (discontinued)" },
    ],
    id: "electronics",
    label: "Electronics",
  },
  {
    children: [
      { id: "furniture", label: "Furniture" },
      { id: "lighting", label: "Lighting" },
      {
        children: [
          { id: "plants", label: "Plants" },
          { id: "tools", label: "Garden tools" },
        ],
        id: "garden",
        label: "Garden",
      },
    ],
    id: "home",
    label: "Home & garden",
  },
  {
    children: [
      { id: "women", label: "Women" },
      { id: "men", label: "Men" },
      { id: "kids", label: "Kids" },
    ],
    id: "fashion",
    label: "Fashion",
  },
];
