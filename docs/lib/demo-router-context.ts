import { createContext } from "react";

/** Navigation of the nearest `DemoRouter`. */
export const DemoNavigateContext = createContext<(href: string) => void>(
  () => {},
);
