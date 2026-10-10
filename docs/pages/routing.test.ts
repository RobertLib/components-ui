// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import type { ReactElement } from "react";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Execute the copyable recipe itself, with the router hooks supplying a
// location. TanStack Router is not a dependency of the documentation app.
const source = ts.createSourceFile(
  "routing.tsx",
  readFileSync(new URL("./routing.tsx", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const recipe = source.statements
  .filter(ts.isVariableStatement)
  .flatMap((statement) => [...statement.declarationList.declarations])
  .find(
    (declaration) => declaration.name.getText(source) === "tanstack",
  )?.initializer;
if (!recipe || !ts.isNoSubstitutionTemplateLiteral(recipe)) {
  throw new Error("The TanStack Router recipe was not found");
}
const compiled = ts.transpileModule(`${recipe.text}\nexport { Link };`, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
  },
}).outputText;
const requireModule = createRequire(import.meta.url);
const exports: {
  Link?: (props: { href: string; children: string }) => ReactElement<{
    href?: string;
    to?: string;
    search?: Record<string, string>;
    hash?: string;
  }>;
} = {};
runInNewContext(compiled, {
  exports,
  URL,
  require: (name: string) => {
    if (name === "@tanstack/react-router") {
      return {
        Link: "router-link",
        useLocation: () => ({
          pathname: "/projects/42/settings",
          searchStr: "?tab=current",
          hash: "old",
        }),
        useRouter: () => ({
          options: {
            parseSearch: (search: string) =>
              Object.fromEntries(new URLSearchParams(search)),
          },
        }),
      };
    }
    if (name === "components-ui") return {};
    return requireModule(name);
  },
});

describe("the documented TanStack Router link adapter", () => {
  it.each([
    ["settings", "/projects/42/settings", {}, ""],
    ["../reports?sort=asc#top", "/projects/reports", { sort: "asc" }, "top"],
    ["?tab=archived", "/projects/42/settings", { tab: "archived" }, ""],
    ["#details", "/projects/42/settings", { tab: "current" }, "details"],
    ["/archive?year=2026", "/archive", { year: "2026" }, ""],
  ])("resolves %s as a browser link", (href, to, search, hash) => {
    const link = exports.Link!({ href, children: "Destination" });
    expect(link.type).toBe("router-link");
    expect(link.props).toMatchObject({ to, search, hash });
  });

  it.each([
    "https://example.com/report",
    "//example.com/report",
    "mailto:help@example.com",
  ])("keeps %s as a plain external link", (href) => {
    const link = exports.Link!({ href, children: "Destination" });
    expect(link.type).toBe("a");
    expect(link.props.href).toBe(href);
  });
});
