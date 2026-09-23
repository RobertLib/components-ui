import { cs, en, UIProvider } from "components-ui";
import { useDocsSettings } from "../lib/settings-context";
import useReactRouterAdapter from "../lib/use-react-router-adapter";

/** The library configured for the docs: the chosen language and React Router. */
export default function DocsUIProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { localeName } = useDocsSettings();
  const router = useReactRouterAdapter();

  return (
    <UIProvider locale={localeName === "cs" ? cs : en} router={router}>
      {children}
    </UIProvider>
  );
}
