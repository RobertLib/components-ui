import path from "node:path";
import ts from "typescript";
import type { Plugin } from "vite";

/**
 * Generates the prop tables of the docs from the library source: every type
 * exported from `src/index.ts` with its properties, their JSDoc and the
 * defaults of the components' destructured props. Served as the virtual
 * module `virtual:docgen` and regenerated when a file in `src/` changes.
 */

import type {
  ComponentDoc,
  DocgenData,
  PropDoc,
  TypeDoc,
} from "../lib/docgen-types.ts";

export type { ComponentDoc, DocgenData, PropDoc, TypeDoc };

const isFromNodeModules = (node: ts.Node) =>
  node.getSourceFile().fileName.includes("node_modules");

const docText = (symbol: ts.Symbol, checker: ts.TypeChecker) =>
  ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim();

/** Source text of a type on one line, without formatter leftovers. */
const cleanTypeText = (text: string) =>
  text
    .replace(/\s+/g, " ")
    .replace(/^\| /, "")
    .replace(/\( /g, "(")
    .replace(/,? \)/g, ")")
    .replace(/\{ /g, "{ ")
    .trim();

/** `React.ComponentProps<"div">` & co. in the heritage of a declaration. */
function collectReactBases(
  declaration: ts.Declaration,
  checker: ts.TypeChecker,
  seen = new Set<ts.Node>(),
): string[] {
  if (seen.has(declaration)) return [];
  seen.add(declaration);

  const bases: string[] = [];
  const addFromTypeNode = (node: ts.Node) => {
    const text = node.getText();

    if (/React\.|ComponentProps|HTMLAttributes/.test(text)) {
      bases.push(cleanTypeText(text).replace(/< /g, "<").replace(/ >/g, ">"));
      return;
    }

    // A local base interface - look through it
    const symbol = checker.getSymbolAtLocation(
      ts.isExpressionWithTypeArguments(node) ? node.expression : node,
    );
    const target =
      symbol && symbol.flags & ts.SymbolFlags.Alias
        ? checker.getAliasedSymbol(symbol)
        : symbol;

    for (const baseDeclaration of target?.declarations ?? []) {
      if (!isFromNodeModules(baseDeclaration)) {
        bases.push(...collectReactBases(baseDeclaration, checker, seen));
      }
    }
  };

  if (ts.isInterfaceDeclaration(declaration)) {
    for (const clause of declaration.heritageClauses ?? []) {
      clause.types.forEach(addFromTypeNode);
    }
  }

  if (ts.isTypeAliasDeclaration(declaration)) {
    const typeNode = declaration.type;
    const parts = ts.isIntersectionTypeNode(typeNode)
      ? typeNode.types
      : ts.isUnionTypeNode(typeNode)
        ? typeNode.types
        : [typeNode];

    for (const part of parts) {
      if (
        ts.isTypeReferenceNode(part) ||
        ts.isExpressionWithTypeArguments(part)
      ) {
        addFromTypeNode(part);
      }
    }
  }

  return [...new Set(bases)];
}

function documentType(
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
): TypeDoc | null {
  const declaration = symbol.declarations?.[0];
  if (!declaration) return null;

  const type = checker.getDeclaredTypeOfSymbol(symbol);
  const constituents = type.isUnion() ? type.types : [type];

  const props = new Map<string, PropDoc & { count: number }>();
  let objectConstituents = 0;

  for (const constituent of constituents) {
    if (
      !(constituent.flags & (ts.TypeFlags.Object | ts.TypeFlags.Intersection))
    ) {
      continue;
    }
    objectConstituents++;

    for (const prop of checker.getPropertiesOfType(constituent)) {
      const propDeclaration = prop.valueDeclaration ?? prop.declarations?.[0];
      if (!propDeclaration || isFromNodeModules(propDeclaration)) continue;

      const typeText =
        (ts.isPropertySignature(propDeclaration) ||
          ts.isPropertyDeclaration(propDeclaration)) &&
        propDeclaration.type
          ? cleanTypeText(propDeclaration.type.getText())
          : checker
              .typeToString(
                checker.getTypeOfSymbolAtLocation(prop, propDeclaration),
                undefined,
                ts.TypeFormatFlags.NoTruncation,
              )
              .replace(/ \| undefined$/, "");

      // `never` props only discriminate the members of a union
      if (typeText === "never") continue;

      const existing = props.get(prop.name);
      const required = !(prop.flags & ts.SymbolFlags.Optional);

      if (existing) {
        existing.count++;
        existing.required &&= required;
        continue;
      }

      const defaultTag = prop
        .getJsDocTags(checker)
        .find((tag) => tag.name === "default");

      props.set(prop.name, {
        count: 1,
        defaultValue: defaultTag?.text
          ? ts.displayPartsToString(defaultTag.text)
          : undefined,
        description: docText(prop, checker),
        name: prop.name,
        required,
        type: typeText,
      });
    }
  }

  if (objectConstituents === 0) return null;

  return {
    description: docText(symbol, checker),
    extends: collectReactBases(declaration, checker),
    props: [...props.values()]
      .map(({ count, ...prop }) => ({
        ...prop,
        // Present in only some members of a union - never required overall
        required: prop.required && count === objectConstituents,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** Defaults of the props destructured in the component's signature. */
function componentDefaults(
  declaration: ts.Declaration,
  checker: ts.TypeChecker,
) {
  const defaults: Record<string, string> = {};
  const parameter = ts.isFunctionDeclaration(declaration)
    ? declaration.parameters[0]
    : undefined;

  if (parameter && ts.isObjectBindingPattern(parameter.name)) {
    for (const element of parameter.name.elements) {
      if (!element.initializer) continue;
      const name = (element.propertyName ?? element.name).getText();
      const { initializer } = element;

      // A named constant - show its value (`100`, not `DEFAULT_PAGE_SIZE`)
      const constantType = ts.isIdentifier(initializer)
        ? checker.getTypeAtLocation(initializer)
        : null;

      defaults[name.replace(/^["']|["']$/g, "")] = constantType?.isLiteral()
        ? checker.typeToString(constantType)
        : initializer.getText();
    }
  }

  return defaults;
}

export function generateDocs(root: string): DocgenData {
  const configPath = path.join(root, "tsconfig.lib.json");
  const config = ts.getParsedCommandLineOfConfigFile(configPath, undefined, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
      throw new Error(
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      );
    },
  });

  if (!config) throw new Error(`Cannot read ${configPath}`);

  const program = ts.createProgram({
    options: { ...config.options, noEmit: true },
    rootNames: config.fileNames,
  });
  const checker = program.getTypeChecker();
  const entry = program.getSourceFile(path.join(root, "src/index.ts"));
  const moduleSymbol = entry && checker.getSymbolAtLocation(entry);

  if (!moduleSymbol) throw new Error("Cannot resolve src/index.ts");

  const data: DocgenData = { components: {}, types: {} };

  for (const exported of checker.getExportsOfModule(moduleSymbol)) {
    const symbol =
      exported.flags & ts.SymbolFlags.Alias
        ? checker.getAliasedSymbol(exported)
        : exported;
    const name = exported.getName();

    if (symbol.flags & (ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias)) {
      const doc = documentType(symbol, checker);
      if (doc) data.types[name] = doc;
    }

    if (
      symbol.flags & (ts.SymbolFlags.Function | ts.SymbolFlags.Class) &&
      symbol.valueDeclaration
    ) {
      data.components[name] = {
        defaults: componentDefaults(symbol.valueDeclaration, checker),
        description: docText(symbol, checker),
      };
    }
  }

  return data;
}

const VIRTUAL_ID = "virtual:docgen";
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

export default function docgen(): Plugin {
  let root = process.cwd();
  let cache: DocgenData | null = null;

  return {
    name: "components-ui:docgen",
    configResolved(config) {
      root = config.root;
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    load(id) {
      if (id !== RESOLVED_ID) return undefined;
      cache ??= generateDocs(root);
      return `export default ${JSON.stringify(cache)};`;
    },
    configureServer(server) {
      const srcDir = path.join(root, "src");

      server.watcher.on("change", (file) => {
        if (!file.startsWith(srcDir)) return;

        cache = null;
        const module = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (module) server.reloadModule(module);
      });
    },
  };
}
