import { HashRouter, Route, Routes } from "react-router";
import { Button, SnackbarProvider } from "components-ui";
import { allPages } from "./pages";
import DocsUIProvider from "./components/docs-ui-provider";
import Layout from "./components/layout";
import SettingsProvider from "./lib/settings-provider";

function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="mb-2 text-3xl font-bold">Page not found</h1>
      <p className="mb-6 text-neutral-500">This page does not exist.</p>
      <Button link="/">Back to the introduction</Button>
    </div>
  );
}

// Hash routing, so the built docs work from any static file host
export default function App() {
  return (
    <HashRouter>
      <SettingsProvider>
        <DocsUIProvider>
          <SnackbarProvider>
            <Routes>
              <Route element={<Layout />}>
                {allPages.map((page) => (
                  <Route
                    element={<page.component />}
                    key={page.path}
                    path={page.path}
                  />
                ))}
                <Route element={<NotFound />} path="*" />
              </Route>
            </Routes>
          </SnackbarProvider>
        </DocsUIProvider>
      </SettingsProvider>
    </HashRouter>
  );
}
