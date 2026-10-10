// A Vite plugin that leaves the classes of the components an app does not
// use out of its CSS. Tailwind generates the classes it finds in the files it
// scans - all of the library's, whether the app renders a component or not.
// Before a build, the plugin follows the imports of the app to the modules of
// the library it uses and keeps the other ones out of the scan (`@source
// not`). `vite dev` keeps all the classes.
//
//   // vite.config.ts
//   import componentsUi from "./src/components/ui/vite.js"; // or "components-ui/vite"
//   export default defineConfig({ plugins: [react(), tailwindcss(), componentsUi()] });
//
// A module of the app it cannot read (a virtual module of another plugin, a
// `.vue` or `.mdx` file) could import any component: the CSS then keeps all
// classes, with a warning. After the build, the plugin checks that the bundle
// has no code of a module it left out - the build fails rather than miss a
// class. JavaScript with the types in `vite.d.ts`, so that the TypeScript
// configuration of an app for the browser leaves this Node module alone.
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import {
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import { fileURLToPath } from "node:url";
import { normalizePath, parseAst, version } from "vite";

// All exports of a module - by a namespace import or `export *`
const ALL = Symbol("all");

// Paths as Vite gives the ids of modules - with `/` also on Windows
const pathOf = (...parts) => normalizePath(join(...parts));

/**
 * Where `file` is, by the names on the disk, as Vite gives the ids too -
 * `realpathSync` keeps the case a path was typed in (macOS, Windows) and the
 * short names of Windows (`RUNNER~1`): the plugin then found no module of
 * the library among those of the app, and left no class out.
 */
function real(file) {
  try {
    return normalizePath(realpathSync.native(file));
  } catch {
    // A drive the call of the system cannot read - a RAM disk on Windows
    return normalizePath(realpathSync(file));
  }
}

const here = real(dirname(fileURLToPath(import.meta.url)));

// The files of this plugin, which no app bundles
const PLUGIN_FILES = ["vite.js", "vite.d.ts"].map((file) => pathOf(here, file));

// Modules the plugin reads
const SCRIPT = /\.[cm]?[jt]sx?$/;

// Imports with no code that could import a component
const ASSET =
  /\.(?:css|less|sass|scss|styl|stylus|pcss|postcss|sss|json|json5|wasm|svg|png|jpe?g|gif|webp|avif|apng|jxl|ico|bmp|cur|woff2?|ttf|otf|eot|mp4|webm|ogg|mp3|wav|flac|aac|opus|m4a|mov|vtt|pdf|txt|xml|csv|webmanifest)$/i;

// A stylesheet that Tailwind generates the classes into
const TAILWIND_ROOT =
  /@import\s+(?:url\(\s*)?["']tailwindcss(?:\/[\w./-]*)?["']|@tailwind\s+utilities/;

/** The location and named manifest of `file`'s package, not a folder stub. */
function packageOf(file) {
  for (
    let directory = dirname(file);
    directory !== dirname(directory);
    directory = dirname(directory)
  ) {
    try {
      const manifest = JSON.parse(
        readFileSync(join(directory, "package.json"), "utf8"),
      );
      if (manifest.name) return { directory, manifest };
    } catch {
      // None here, or not JSON
    }
  }
  return undefined;
}

/**
 * The public API of the library and the folders of its modules - of a
 * source copy, or of the package and its build, which an app imports by the
 * package name (`name`, `undefined` for a copy). The package is the one whose
 * `exports` give this plugin, by any name - published under a scope too
 * (`@acme/components-ui`).
 */
function findLibrary() {
  const sources = pathOf(here, "../..");
  const entries = [pathOf(here, "index.ts")];
  const roots = [sources];
  const root = pathOf(sources, "..");
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  } catch {
    // A source copy in a folder without a manifest
  }
  const plugin = manifest?.exports?.["./vite"];
  const file = typeof plugin === "string" ? plugin : plugin?.default;
  const isPackage =
    typeof file === "string" && pathOf(root, file) === pathOf(here, "vite.js");
  if (isPackage) {
    entries.push(
      pathOf(sources, "index.ts"),
      pathOf(root, "dist/index.js"),
      pathOf(root, "dist/components/ui/index.js"),
    );
    roots.push(pathOf(root, "dist"));
  }
  return {
    entries: entries.filter((entry) => existsSync(entry)),
    name: isPackage ? manifest.name : undefined,
    roots,
  };
}

/** The name an import or export specifier gives - also a string one. */
const nameOf = (node) => node.name ?? node.value;

/**
 * What a module imports and exports - its imports with the names it takes
 * (none for an import of its effects), its re-exports, the sources of its
 * `export *`, the names it defines and its dynamic imports. Types are left
 * out: they add no code. `file` gives the language.
 */
function readModule(file, code = readFileSync(file, "utf8")) {
  const extension = extname(file);
  const lang = /ts$/.test(extension)
    ? "ts"
    : extension === ".tsx"
      ? "tsx"
      : "jsx";
  const ast = parseAst(code, { lang });
  const facts = {
    imports: [],
    reexports: new Map(),
    stars: [],
    locals: new Set(),
    dynamic: [],
  };

  // The names the imports bind - exported, they are re-exports, as the build
  // of the package writes them (`import { a } from "./a.js"; export { a };`)
  const bindings = new Map();
  for (const node of ast.body) {
    if (node.type !== "ImportDeclaration" || node.importKind === "type") {
      continue;
    }
    const names = [];
    for (const specifier of node.specifiers) {
      if (specifier.importKind === "type") continue;
      const name =
        specifier.type === "ImportDefaultSpecifier"
          ? "default"
          : specifier.type === "ImportNamespaceSpecifier"
            ? ALL
            : nameOf(specifier.imported);
      names.push(name);
      bindings.set(specifier.local.name, { source: node.source.value, name });
    }
    // `import { type A } from` takes nothing - TypeScript leaves it out
    if (names.length > 0 || node.specifiers.length === 0) {
      facts.imports.push({ source: node.source.value, names });
    }
  }

  for (const node of ast.body) {
    if (node.type === "ExportNamedDeclaration") {
      if (node.exportKind === "type" || node.declaration?.declare) continue;
      for (const specifier of node.specifiers) {
        if (specifier.exportKind === "type") continue;
        const exported = nameOf(specifier.exported);
        const local = nameOf(specifier.local);
        const reexport = node.source
          ? { source: node.source.value, name: local }
          : bindings.get(local);
        if (reexport) facts.reexports.set(exported, { ...reexport });
        else facts.locals.add(exported);
      }
      const declaration = node.declaration;
      if (declaration?.id) facts.locals.add(declaration.id.name);
      for (const declarator of declaration?.declarations ?? []) {
        // A destructuring export defines names the plugin does not list -
        // any name then is this module's
        facts.locals.add(
          declarator.id.type === "Identifier" ? declarator.id.name : ALL,
        );
      }
    } else if (node.type === "ExportDefaultDeclaration") {
      const { declaration } = node;
      const binding =
        declaration.type === "Identifier" && bindings.get(declaration.name);
      if (binding) facts.reexports.set("default", { ...binding });
      else facts.locals.add("default");
    } else if (node.type === "ExportAllDeclaration") {
      if (node.exportKind === "type") continue;
      if (node.exported) {
        facts.reexports.set(nameOf(node.exported), {
          source: node.source.value,
          name: ALL,
        });
      } else {
        facts.stars.push(node.source.value);
      }
    }
  }

  visit(ast, (node) => {
    if (node.type === "ImportExpression") {
      const source = node.source;
      if (source.type === "Literal" && typeof source.value === "string") {
        facts.dynamic.push({ source: source.value });
      } else if (source.type === "TemplateLiteral") {
        // `import(`./locales/${code}.ts`)` - Vite bundles the files the
        // start of the path matches. Another expression it leaves to the
        // browser, which loads the module from the server.
        facts.dynamic.push({ prefix: source.quasis[0].value.cooked });
      }
    } else if (
      node.type === "CallExpression" &&
      node.callee.type === "MemberExpression" &&
      node.callee.object.type === "MetaProperty" &&
      nameOf(node.callee.property) === "glob"
    ) {
      // `import.meta.glob("./pages/*.tsx")`
      const [argument] = node.arguments;
      const patterns = (
        argument?.type === "ArrayExpression" ? argument.elements : [argument]
      ).map((element) =>
        element?.type === "Literal" && typeof element.value === "string"
          ? element.value
          : null,
      );
      facts.dynamic.push({ patterns });
    }
  });

  return facts;
}

/** Calls `callback` with each node of the syntax tree. */
function visit(node, callback) {
  if (Array.isArray(node)) {
    for (const child of node) visit(child, callback);
  } else if (node && typeof node === "object") {
    if (typeof node.type === "string") callback(node);
    for (const key in node) {
      const value = node[key];
      if (value && typeof value === "object") visit(value, callback);
    }
  }
}

/** The module scripts of a page - the paths of `src`, or the code inline. */
function readPage(file) {
  const scripts = [];
  const html = readFileSync(file, "utf8").replace(/<!--[\s\S]*?-->/g, "");
  for (const [, attributes, code] of html.matchAll(
    /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi,
  )) {
    if (!/\btype\s*=\s*["']?module\b/i.test(attributes)) continue;
    const src = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(
      attributes,
    );
    scripts.push(src ? { src: src[1] ?? src[2] ?? src[3] } : { code });
  }
  return scripts;
}

/** The script files in `directory` and below it. */
function scriptsIn(directory) {
  const files = [];
  if (!existsSync(directory)) return files;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...scriptsIn(path));
    else if (SCRIPT.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      files.push(path);
    }
  }
  return files;
}

/** Whether `file` is in `folder` - on another drive of Windows it is not. */
function isInside(folder, file) {
  const path = relative(folder, file);
  return !path.startsWith("..") && !isAbsolute(path);
}

/**
 * A path for `@source` - its braces escaped, which Tailwind would expand
 * (`{a,b}`), and its quotes. The other characters of a glob Tailwind takes
 * as they are in the path of a file: escaped, it matched none - `\@` of a
 * scope or of the store of pnpm (`.pnpm/components-ui@0.6.1`), `\(`, `\+`.
 */
const sourcePath = (file) => normalizePath(file).replace(/[{}"]/g, "\\$&");

/**
 * The modules of the library the app does not use - or why the plugin
 * cannot tell (`reason`).
 */
async function findUnusedModules(context, config, input) {
  const { root, resolve: resolveOptions } = config;

  /** The file `source` imported from `importer` resolves to, with its query. */
  const resolveFile = async (source, importer) => {
    const resolved = await context.resolve(source, importer);
    if (!resolved || resolved.external) return undefined;
    const [id, query = ""] = resolved.id.split("?");
    const readable = !id.startsWith("\0") && existsSync(id);
    return { id: resolved.id, file: readable ? real(id) : null, query };
  };

  // The library - the modules its public API imports, with the modules they
  // import resolved
  const library = new Map();
  const { entries, name: packageName, roots } = findLibrary();
  const isLibraryFile = (file) =>
    SCRIPT.test(file) && roots.some((folder) => isInside(folder, file));
  const pending = [...entries];
  while (pending.length > 0) {
    const file = pending.pop();
    if (library.has(file)) continue;
    const facts = readModule(file);
    library.set(file, facts);
    const link = async (source) => {
      const target = (await resolveFile(source, file))?.file;
      if (!target || !isLibraryFile(target)) return undefined;
      pending.push(target);
      return target;
    };
    for (const entry of facts.imports) entry.id = await link(entry.source);
    for (const entry of facts.reexports.values()) {
      entry.id = await link(entry.source);
    }
    facts.stars = (await Promise.all(facts.stars.map(link))).filter(Boolean);
  }

  // The modules of the library the app may use: a module one of whose own
  // exports it takes, with all the module imports - a re-export is followed
  // to the module it comes from
  const used = new Set();
  const requested = new Set();
  const include = (file) => {
    if (used.has(file)) return;
    used.add(file);
    for (const { id, names } of library.get(file).imports) {
      if (!id) continue;
      if (names.length === 0) include(id);
      for (const name of names) request(id, name);
    }
  };
  const request = (file, name) => {
    const key = `${file}\0${String(name)}`;
    if (requested.has(key)) return;
    requested.add(key);
    const facts = library.get(file);
    if (name === ALL) {
      include(file);
      for (const { id, name: source } of facts.reexports.values()) {
        if (id) request(id, source);
      }
      for (const star of facts.stars) request(star, ALL);
      return;
    }
    const reexport = facts.reexports.get(name);
    if (reexport) {
      if (reexport.id) request(reexport.id, reexport.name);
    } else if (facts.locals.has(name) || facts.locals.has(ALL)) {
      include(file);
    } else if (facts.stars.length > 0) {
      for (const star of facts.stars) request(star, name);
    } else {
      // A name it does not export - a type imported without `type`
      include(file);
    }
  };

  // The app - from the entries of the build, through its modules and those
  // of the packages that depend on the library
  const visited = new Set();
  const modules = [];
  let reason;
  const cannotRead = (id) => {
    reason ??= `it cannot read the module "${id.replace("\0", "")}", which could import components`;
  };
  const shortPath = (file) => normalizePath(relative(root, file));

  // A wrapper can depend on another wrapper that imports the library. Keep
  // following those packages too, without parsing unrelated packages such
  // as React. Walk the whole dependency graph: a cycle alone uses no UI.
  const packageUsesLibrary = new Map();
  const usesLibrary = async (file) => {
    if (packageName === undefined) return false;
    const initial = packageOf(file);
    if (!initial) return true;
    if (packageUsesLibrary.has(initial.directory)) {
      return packageUsesLibrary.get(initial.directory);
    }
    const visited = new Set();
    const pending = [initial];
    while (pending.length > 0) {
      const { directory, manifest } = pending.pop();
      if (visited.has(directory)) continue;
      visited.add(directory);
      if (packageUsesLibrary.get(directory) === false) continue;
      const dependencies = new Set([
        ...Object.keys(manifest.dependencies ?? {}),
        ...Object.keys(manifest.peerDependencies ?? {}),
        ...Object.keys(manifest.optionalDependencies ?? {}),
      ]);
      if (
        manifest.name === packageName ||
        packageUsesLibrary.get(directory) === true ||
        dependencies.has(packageName)
      ) {
        packageUsesLibrary.set(initial.directory, true);
        return true;
      }
      for (const dependency of dependencies) {
        let target;
        try {
          target = await resolveFile(
            dependency,
            pathOf(directory, "package.json"),
          );
        } catch {
          // No root export - the app may import an exported subpath alone.
        }
        let info = target?.file ? packageOf(target.file) : undefined;
        // A package can export only subpaths, so resolving its bare name
        // fails. Its manifest is still available in a node_modules tree.
        for (
          let parent = directory;
          !info && parent !== dirname(parent);
          parent = dirname(parent)
        ) {
          const path = pathOf(
            parent,
            "node_modules",
            dependency,
            "package.json",
          );
          if (existsSync(path)) info = packageOf(path);
        }
        if (!info) {
          // Unavailable to this resolver (or supplied by another plugin):
          // read the importing package rather than exclude its components.
          packageUsesLibrary.set(initial.directory, true);
          return true;
        }
        pending.push(info);
      }
    }
    for (const directory of visited) packageUsesLibrary.set(directory, false);
    return false;
  };

  const enqueue = (file) => {
    if (library.has(file)) request(file, ALL);
    else if (!visited.has(file) && !PLUGIN_FILES.includes(file)) {
      visited.add(file);
      modules.push({ file, importer: file });
    }
  };

  /** Follows an import of `source` from `importer` that takes `names`. */
  const follow = async (source, importer, names) => {
    const resolved = await resolveFile(source, importer);
    if (!resolved) return;
    const { file, query } = resolved;
    if (/^\0?__vite-browser-external/.test(resolved.id)) {
      // The empty stand-in of a module of Node in a browser
    } else if (!file) {
      cannotRead(resolved.id);
    } else if (library.has(file)) {
      if (names.length === 0) include(file);
      for (const name of names) request(file, name);
    } else if (ASSET.test(file) || /\bworker\b/.test(query)) {
      // No code of the page - or a worker, which renders nothing
    } else if (!SCRIPT.test(file)) {
      cannotRead(resolved.id);
    } else if (!file.includes("/node_modules/") || (await usesLibrary(file))) {
      enqueue(file);
    }
  };

  /**
   * The folder of the files a path pattern of `import.meta.glob` or of a
   * dynamic import can match - the part before the first special character
   * of a glob, its aliases replaced. `undefined` for a path Vite does not
   * bundle by.
   */
  const patternBase = (pattern, importer) => {
    // Up to the last `/` before the first special character of a glob
    const plain = pattern.slice(0, pattern.search(/[*?[\]{}()!]|$/));
    let path = plain.slice(0, plain.lastIndexOf("/") + 1);
    let aliased = false;
    for (const { find, replacement } of resolveOptions.alias) {
      if (
        typeof find === "string"
          ? path === find || path.startsWith(`${find}/`)
          : find.test(path)
      ) {
        path = path.replace(find, replacement);
        aliased = true;
        break;
      }
    }
    if (path.startsWith("./") || path.startsWith("../")) {
      path = resolve(aliased ? root : dirname(importer), path);
    } else if (!path.startsWith("/") && !isAbsolute(path)) {
      return undefined;
    }
    const base = normalizePath(path);
    // A path from the root of the project, as Vite reads `/src/...`
    return existsSync(base) || !existsSync(pathOf(root, base))
      ? base
      : pathOf(root, base);
  };

  for (const entry of Array.isArray(input)
    ? input
    : Object.values(input ?? {})) {
    const file = resolve(root, entry);
    if (/\.html?$/i.test(file) && existsSync(file)) {
      const scripts = readPage(file);
      if (scripts.length === 0) {
        reason ??= `the page "${shortPath(file)}" has no module script`;
      }
      for (const script of scripts) {
        if (script.src) await follow(script.src, file, [ALL]);
        else modules.push({ file: "inline.js", importer: file, ...script });
      }
    } else {
      await follow(existsSync(file) ? file : entry, undefined, [ALL]);
    }
  }

  while (modules.length > 0 && !reason) {
    const { file, importer, code } = modules.pop();
    let facts;
    try {
      facts = readModule(file, code);
    } catch {
      reason = `it cannot parse "${shortPath(importer)}"`;
      break;
    }
    for (const { source, names } of facts.imports) {
      await follow(source, importer, names);
    }
    for (const { source, name } of facts.reexports.values()) {
      await follow(source, importer, [name]);
    }
    for (const source of facts.stars) await follow(source, importer, [ALL]);
    for (const dynamic of facts.dynamic) {
      if (dynamic.source !== undefined) {
        await follow(dynamic.source, importer, [ALL]);
      } else if (dynamic.prefix !== undefined) {
        const base = patternBase(dynamic.prefix, importer);
        for (const script of base ? scriptsIn(base) : []) {
          enqueue(real(script));
        }
      } else {
        for (const pattern of dynamic.patterns) {
          if (pattern?.startsWith("!")) continue;
          const base = pattern ? patternBase(pattern, importer) : undefined;
          if (base === undefined) {
            reason ??= `it cannot follow a pattern of "${shortPath(importer)}"`;
            break;
          }
          for (const script of scriptsIn(base)) enqueue(real(script));
        }
      }
    }
  }

  if (reason) return { reason };
  const unused = new Set(PLUGIN_FILES.filter((file) => existsSync(file)));
  for (const file of library.keys()) if (!used.has(file)) unused.add(file);
  return { unused };
}

/**
 * The plugin - add it to the plugins of the app's `vite.config.ts`, in any
 * place: it extends the stylesheet before Tailwind reads it.
 */
export default function componentsUi() {
  let config;
  // By environment (client, ssr): the modules of the library left out of
  // Tailwind's sources, and whether a stylesheet of Tailwind took them
  const builds = new Map();
  const environmentOf = (context) => context.environment?.name ?? "";

  return {
    name: "components-ui",
    apply: "build",
    configResolved(resolved) {
      config = resolved;
    },
    async buildStart(options) {
      builds.delete(environmentOf(this));
      if (Number(version.split(".")[0]) < 8) {
        this.warn(
          "The CSS keeps the classes of all components: the plugin needs Vite 8 or newer",
        );
        return;
      }
      let unused;
      let reason;
      try {
        ({ unused, reason } = await findUnusedModules(
          this,
          config,
          options.input,
        ));
      } catch (error) {
        reason = `it failed to follow the imports (${error.message})`;
      }
      if (reason) {
        this.warn(`The CSS keeps the classes of all components: ${reason}`);
        return;
      }
      builds.set(environmentOf(this), { unused, applied: false });
    },
    transform: {
      // Before Tailwind generates the classes
      order: "pre",
      // Not a stylesheet imported as text or as a URL, which Tailwind
      // leaves alone too
      filter: {
        id: {
          include: /\.css(?:$|\?)/,
          exclude: /[?&](?:raw|url|worker|sharedworker)\b/,
        },
      },
      handler(code) {
        const build = builds.get(environmentOf(this));
        if (!build || !TAILWIND_ROOT.test(code)) return undefined;
        build.applied = true;
        const sources = [...build.unused]
          .map((file) => `@source not "${sourcePath(file)}";`)
          .join("\n");
        // At the end - no line of the stylesheet moves
        return { code: `${code}\n${sources}\n`, map: null };
      },
    },
    generateBundle(_, bundle) {
      const build = builds.get(environmentOf(this));
      if (!build?.applied) return;
      const missed = new Set();
      for (const output of Object.values(bundle)) {
        if (output.type !== "chunk") continue;
        for (const [id, module] of Object.entries(output.modules)) {
          // A class comes in a string. The code of a module without one -
          // the bundler starts a CommonJS package where it is first imported
          // (`var import_react = require_react()`) - can miss none.
          const rendered =
            module.code ?? (module.renderedLength > 0 ? '"' : "");
          const code = rendered.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
          if (build.unused.has(id) && /["'`]/.test(code)) {
            missed.add(normalizePath(relative(config.root, id)));
          }
        }
      }
      if (missed.size > 0) {
        this.error(
          `The bundle has code of ${[...missed].join(", ")}, which the plugin ` +
            "left out of Tailwind's sources: classes of it could be missing " +
            "from the CSS. Another plugin may add imports the code of the app " +
            "does not have. Without this plugin the CSS keeps the classes of " +
            "all components.",
        );
      }
    },
  };
}
