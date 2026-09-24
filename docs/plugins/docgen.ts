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

interface Context {
  checker: ts.TypeChecker;
  /** Everything `src/index.ts` exports, by the symbol it stands for. */
  publicNames: Map<ts.Symbol, string>;
}

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

/** The symbol a type reference or a heritage clause names, through imports. */
function resolveReference(node: ts.Node, checker: ts.TypeChecker) {
  const name = ts.isTypeReferenceNode(node)
    ? node.typeName
    : ts.isExpressionWithTypeArguments(node)
      ? node.expression
      : node;
  const symbol = checker.getSymbolAtLocation(name);

  return symbol && symbol.flags & ts.SymbolFlags.Alias
    ? checker.getAliasedSymbol(symbol)
    : symbol;
}

/** Whether `type` written in place of `reference` needs parentheses. */
function needsParentheses(reference: ts.TypeReferenceNode, type: ts.TypeNode) {
  const { parent } = reference;
  const isUnion = ts.isUnionTypeNode(type);
  const isIntersection = ts.isIntersectionTypeNode(type);

  if (
    !isUnion &&
    !isIntersection &&
    !ts.isFunctionTypeNode(type) &&
    !ts.isConstructorTypeNode(type) &&
    !ts.isConditionalTypeNode(type)
  ) {
    return false;
  }

  if (ts.isUnionTypeNode(parent)) return !isUnion && !isIntersection;
  if (ts.isIntersectionTypeNode(parent)) return !isIntersection;

  return (
    ts.isArrayTypeNode(parent) ||
    ts.isTypeOperatorNode(parent) ||
    ts.isIndexedAccessTypeNode(parent) ||
    ts.isOptionalTypeNode(parent) ||
    ts.isRestTypeNode(parent)
  );
}

const printer = ts.createPrinter({ removeComments: true });

/**
 * The type a local alias that is not part of the public API stands for - a
 * reader cannot look up `PickerDim`, but can read `"sm" | "md" | "lg"`.
 * `undefined` for everything else, which keeps its name.
 */
function expandPrivateAlias(
  reference: ts.TypeReferenceNode,
  context: Context,
  seen: Set<ts.Symbol>,
): string | undefined {
  const { checker, publicNames } = context;
  const symbol = resolveReference(reference, checker);

  if (
    !symbol ||
    !(symbol.flags & ts.SymbolFlags.TypeAlias) ||
    publicNames.has(symbol) ||
    seen.has(symbol)
  ) {
    return undefined;
  }

  const declaration = symbol.declarations?.find(ts.isTypeAliasDeclaration);
  if (!declaration || isFromNodeModules(declaration)) return undefined;

  let type: ts.TypeNode | undefined = declaration.type;
  let text: string;

  if (declaration.typeParameters) {
    // A generic alias - let the checker write it with the type arguments
    type = checker.typeToTypeNode(
      checker.getTypeFromTypeNode(reference),
      undefined,
      ts.NodeBuilderFlags.NoTruncation | ts.NodeBuilderFlags.InTypeAlias,
    );
    if (!type) return undefined;
    text = printer.printNode(
      ts.EmitHint.Unspecified,
      type,
      reference.getSourceFile(),
    );
  } else {
    text = typeNodeText(type, context, new Set(seen).add(symbol))
      .trim()
      // A union or an intersection written with a leading operator
      .replace(/^[|&]\s*/, "");
  }

  return needsParentheses(reference, type) ? `(${text})` : text;
}

/** Source text of a type with the private aliases in it expanded. */
function typeNodeText(
  node: ts.TypeNode,
  context: Context,
  seen = new Set<ts.Symbol>(),
): string {
  const source = node.getSourceFile();
  let text = "";
  let position = node.getStart(source);

  const visit = (child: ts.Node) => {
    const expanded = ts.isTypeReferenceNode(child)
      ? expandPrivateAlias(child, context, seen)
      : undefined;

    if (expanded === undefined) {
      ts.forEachChild(child, visit);
      return;
    }

    text += source.text.slice(position, child.getStart(source)) + expanded;
    position = child.getEnd();
  };

  visit(node);
  return text + source.text.slice(position, node.getEnd());
}

/** The string literals of a type like `"link" | "size"`. */
function stringLiterals(node: ts.TypeNode, checker: ts.TypeChecker) {
  const type = checker.getTypeFromTypeNode(node);
  return (type.isUnion() ? type.types : [type])
    .filter((member) => member.isStringLiteral())
    .map((member) => member.value);
}

/**
 * A React base of a local type seen through `Omit` or `Pick` of that type -
 * with the keys that are no props of the local type itself:
 * `Omit<IconButtonProps, "children" | "loading">` accepts the props of
 * `Omit<React.ComponentProps<"button">, "children">`.
 */
function throughUtility(
  utility: "Omit" | "Pick",
  base: string,
  keys: string[],
) {
  if (keys.length === 0) return utility === "Omit" ? base : undefined;

  const keysText = keys.map((key) => JSON.stringify(key)).join(" | ");
  // `Omit<Omit<X, "a">, "b">` is `Omit<X, "a" | "b">`
  const omitted = /^Omit<(.*), ([^,]*)>$/.exec(base);

  return utility === "Omit" && omitted
    ? `Omit<${omitted[1]}, ${omitted[2]} | ${keysText}>`
    : `${utility}<${base}, ${keysText}>`;
}

/** `React.ComponentProps<"div">` & co. in the heritage of a declaration. */
function collectReactBases(
  declaration: ts.Declaration,
  checker: ts.TypeChecker,
  seen = new Set<ts.Node>(),
): string[] {
  if (seen.has(declaration)) return [];
  seen.add(declaration);

  const bases: string[] = [];

  // The React bases of a local type - looked through
  const basesOfLocalType = (node: ts.Node) =>
    (resolveReference(node, checker)?.declarations ?? [])
      .filter((baseDeclaration) => !isFromNodeModules(baseDeclaration))
      .flatMap((baseDeclaration) =>
        collectReactBases(baseDeclaration, checker, seen),
      );

  const addFromTypeNode = (node: ts.Node) => {
    const text = node.getText();

    if (/React\.|ComponentProps|HTMLAttributes/.test(text)) {
      bases.push(cleanTypeText(text).replace(/< /g, "<").replace(/ >/g, ">"));
      return;
    }

    // `Omit<ButtonProps, "link">` - the bases of the local type, less the
    // DOM props it leaves out (`link` is one of `ButtonProps` itself)
    const typeArguments =
      ts.isTypeReferenceNode(node) || ts.isExpressionWithTypeArguments(node)
        ? node.typeArguments
        : undefined;
    const utility = resolveReference(node, checker)?.getName();

    if (
      (utility === "Omit" || utility === "Pick") &&
      typeArguments?.length === 2
    ) {
      const [local, keysNode] = typeArguments;
      const ownProps = new Set(
        checker
          .getPropertiesOfType(checker.getTypeFromTypeNode(local))
          .filter((prop) =>
            (prop.declarations ?? []).some((node) => !isFromNodeModules(node)),
          )
          .map((prop) => prop.getName()),
      );
      const keys = stringLiterals(keysNode, checker).filter(
        (key) => !ownProps.has(key),
      );

      for (const base of basesOfLocalType(local)) {
        const shown = throughUtility(utility, base, keys);
        if (shown) bases.push(shown);
      }
      return;
    }

    // A local base type - look through it
    bases.push(...basesOfLocalType(node));
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

function documentType(symbol: ts.Symbol, context: Context): TypeDoc | null {
  const { checker } = context;
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
      const declarations = prop.declarations ?? [];
      const localDeclarations = declarations.filter(
        (node) => !isFromNodeModules(node),
      );

      // Props of React and the DOM are summed up by `extends` - unless the
      // library declares them as well, like the `color` of `Chip`, which
      // replaces the DOM attribute of the same name
      const propDeclaration = localDeclarations[0];
      if (!propDeclaration) continue;

      // A prop of an intersection carries the declarations of every member -
      // the JSDoc and the type come from the library's own one
      const ownName = ts.getNameOfDeclaration(propDeclaration);
      const ownSymbol =
        localDeclarations.length < declarations.length && ownName
          ? (checker.getSymbolAtLocation(ownName) ?? prop)
          : prop;

      const typeText =
        (ts.isPropertySignature(propDeclaration) ||
          ts.isPropertyDeclaration(propDeclaration)) &&
        propDeclaration.type
          ? cleanTypeText(typeNodeText(propDeclaration.type, context))
          : checker
              .typeToString(
                checker.getTypeOfSymbolAtLocation(ownSymbol, propDeclaration),
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

      const defaultTag = ownSymbol
        .getJsDocTags(checker)
        .find((tag) => tag.name === "default");

      props.set(prop.name, {
        count: 1,
        defaultValue: defaultTag?.text
          ? ts.displayPartsToString(defaultTag.text)
          : undefined,
        description: docText(ownSymbol, checker),
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

/** The exported type a parameter is declared with, e.g. `ButtonProps`. */
function parameterTypeName(
  parameter: ts.ParameterDeclaration,
  context: Context,
) {
  let typeNode = parameter.type;

  // `Readonly<DrawerProviderProps>`
  while (
    typeNode &&
    ts.isTypeReferenceNode(typeNode) &&
    typeNode.typeName.getText() === "Readonly" &&
    typeNode.typeArguments?.length === 1
  ) {
    typeNode = typeNode.typeArguments[0];
  }

  if (!typeNode || !ts.isTypeReferenceNode(typeNode)) return undefined;

  const symbol = resolveReference(typeNode, context.checker);
  return symbol && context.publicNames.get(symbol);
}

/**
 * Defaults of the props a function destructures, by the exported type of
 * the parameter - `ButtonProps` of `Button({ … }: ButtonProps)`, the options
 * of `uploadWithProgress(url, body, { … }: UploadWithProgressOptions)`.
 */
function destructuredDefaults(declaration: ts.Declaration, context: Context) {
  const byType = new Map<string, Record<string, string>>();
  if (!ts.isFunctionDeclaration(declaration)) return byType;

  for (const parameter of declaration.parameters) {
    const typeName = parameterTypeName(parameter, context);
    if (!typeName || !ts.isObjectBindingPattern(parameter.name)) continue;

    const defaults: Record<string, string> = {};

    for (const element of parameter.name.elements) {
      if (!element.initializer) continue;
      const name = (element.propertyName ?? element.name).getText();
      const { initializer } = element;

      // A named constant - show its value (`100`, not `DEFAULT_PAGE_SIZE`)
      const constantType = ts.isIdentifier(initializer)
        ? context.checker.getTypeAtLocation(initializer)
        : null;

      defaults[name.replace(/^["']|["']$/g, "")] = constantType?.isLiteral()
        ? context.checker.typeToString(constantType)
        : initializer.getText();
    }

    byType.set(typeName, defaults);
  }

  return byType;
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

  const exports = checker.getExportsOfModule(moduleSymbol).map((exported) => ({
    name: exported.getName(),
    symbol:
      exported.flags & ts.SymbolFlags.Alias
        ? checker.getAliasedSymbol(exported)
        : exported,
  }));
  const context: Context = {
    checker,
    publicNames: new Map(exports.map(({ name, symbol }) => [symbol, name])),
  };

  const data: DocgenData = { components: {}, types: {} };
  const defaultsByType = new Map<string, Record<string, string>>();

  for (const { name, symbol } of exports) {
    if (symbol.flags & (ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias)) {
      const doc = documentType(symbol, context);
      if (doc) data.types[name] = doc;
    }

    if (
      symbol.flags & (ts.SymbolFlags.Function | ts.SymbolFlags.Class) &&
      symbol.valueDeclaration
    ) {
      data.components[name] = { description: docText(symbol, checker) };

      const found = destructuredDefaults(symbol.valueDeclaration, context);

      for (const [typeName, defaults] of found) {
        const known = defaultsByType.get(typeName);

        defaultsByType.set(
          typeName,
          // The component named after the type wins (`Button` for `ButtonProps`)
          typeName === `${name}Props`
            ? { ...known, ...defaults }
            : { ...defaults, ...known },
        );
      }
    }
  }

  // The defaults of the destructured props are what the prop tables show -
  // they win over a `@default` tag, which could fall behind the code
  for (const [typeName, defaults] of defaultsByType) {
    for (const prop of data.types[typeName]?.props ?? []) {
      prop.defaultValue = defaults[prop.name] ?? prop.defaultValue;
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
