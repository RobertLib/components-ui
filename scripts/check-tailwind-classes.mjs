// Uses the same Tailwind canonicalization as VS Code's suggestCanonicalClasses
// diagnostic, with the project's theme. Runs in `npm run lint`.
import babel from "@babel/core";
import { __unstable__loadDesignSystem } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const scanner = new Scanner({});
const codeExtension = /\.[cm]?[jt]sx?$/;

/** Check literal class names, including constants and docs code snippets.
 * Scanning JavaScript expressions would mistake `!filter` for a utility. */
function literalRanges(source, file) {
  const ast = babel.parseSync(source, {
    filename: file,
    babelrc: false,
    configFile: false,
    parserOpts: {
      plugins: /\.[cm]?tsx?$/.test(file) ? ["typescript", "jsx"] : ["jsx"],
    },
  });
  const ranges = [];
  babel.traverse(ast, {
    StringLiteral({ node }) {
      ranges.push([node.start + 1, node.end - 1]);
    },
    TemplateElement({ node }) {
      ranges.push([node.start, node.end]);
    },
  });
  return ranges;
}

/** Keep offsets intact when ignoring comments. */
function withoutCssComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    " ".repeat(comment.length),
  );
}

export function collectCandidates(source, file) {
  const extension = extname(file).slice(1);
  let ranges;
  let content = source;

  if (codeExtension.test(file)) {
    ranges = literalRanges(source, file);
  } else if (extension === "css") {
    content = withoutCssComments(source);
    // Oxide does not extract the last class immediately before a semicolon.
    // Scan each @apply body without it, rather than scanning the whole CSS.
    ranges = [...content.matchAll(/@apply\s+([^;{}]*);/g)].map((match) => [
      match.index + match[0].indexOf(match[1]),
      match.index + match[0].length - 1,
    ]);
  } else if (extension === "html") {
    ranges = [
      ...source.matchAll(/\bclass(?:Name)?\s*=\s*(["'])([\s\S]*?)\1/g),
    ].map((match) => [
      match.index + match[0].indexOf(match[1]) + 1,
      match.index + match[0].length - 1,
    ]);
  } else {
    // Markdown documents mention utility names outside their code fences too.
    ranges = [[0, source.length]];
  }

  return ranges.flatMap(([start, end]) =>
    scanner
      .getCandidatesWithPositions({
        content: content.slice(start, end),
        extension,
      })
      .map(({ candidate, position }) => ({
        candidate,
        position: start + position,
      }))
      // Oxide exposes JS string offsets, including in non-ASCII documents.
      .filter(
        ({ candidate, position }) =>
          source.slice(position, position + candidate.length) === candidate,
      ),
  );
}

export function findNonCanonicalClasses(
  source,
  file,
  designSystem,
  cache = new Map(),
) {
  const seen = new Set();
  const findings = [];
  for (const { candidate, position } of collectCandidates(source, file)) {
    if (!cache.has(candidate)) {
      // canonicalizeCandidates deduplicates its output; canonicalize one
      // unique candidate at a time instead of aligning two arrays by index.
      cache.set(
        candidate,
        designSystem.canonicalizeCandidates([candidate], { rem: 16 })[0],
      );
    }
    const canonical = cache.get(candidate);
    if (!canonical || canonical === candidate || seen.has(position)) continue;
    seen.add(position);
    findings.push({ candidate, canonical, position });
  }
  return findings.sort((a, b) => a.position - b.position);
}

export function fixClasses(source, findings) {
  let previousEnd = 0;
  for (const { candidate, position } of findings) {
    if (
      position < previousEnd ||
      source.slice(position, position + candidate.length) !== candidate
    ) {
      throw new Error("Overlapping or invalid Tailwind replacement ranges");
    }
    previousEnd = position + candidate.length;
  }
  for (const { candidate, canonical, position } of [...findings].reverse()) {
    source =
      source.slice(0, position) +
      canonical +
      source.slice(position + candidate.length);
  }
  return source;
}

function* sourceFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (file !== join(root, "src/test")) yield* sourceFiles(file);
    } else if (
      /\.(?:[cm]?[jt]sx?|css|html|mdx?)$/.test(entry.name) &&
      !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name)
    ) {
      // Legacy spellings in compatibility tests are intentional. Browser
      // fixtures remain checked because they render actual components.
      yield file;
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--fix")) {
    throw new Error("Usage: node scripts/check-tailwind-classes.mjs [--fix]");
  }
  const fix = args.includes("--fix");
  const stylesheet = join(root, "docs/styles.css");
  const designSystem = await __unstable__loadDesignSystem(
    readFileSync(stylesheet, "utf8"),
    { base: dirname(stylesheet) },
  );
  const files = ["src", "docs", "tests"].flatMap((directory) => [
    ...sourceFiles(join(root, directory)),
  ]);
  for (const entry of readdirSync(root)) {
    if (/\.(?:md|html)$/.test(entry) && entry !== "CHANGELOG.md") {
      files.push(join(root, entry));
    }
  }
  const cache = new Map();
  let count = 0;
  let updatedFiles = 0;
  for (const file of files.sort()) {
    const source = readFileSync(file, "utf8");
    const findings = findNonCanonicalClasses(source, file, designSystem, cache);
    if (findings.length === 0) continue;
    count += findings.length;
    if (fix) {
      writeFileSync(file, fixClasses(source, findings));
      updatedFiles += 1;
    } else {
      for (const { candidate, canonical, position } of findings) {
        const prefix = source.slice(0, position);
        const line = prefix.split("\n").length;
        const column = position - prefix.lastIndexOf("\n");
        console.error(
          `${relative(root, file)}:${line}:${column} - ${candidate} -> ${canonical}`,
        );
      }
    }
  }
  if (fix) {
    console.log(`Updated ${count} Tailwind classes in ${updatedFiles} files`);
  } else if (count > 0) {
    console.error(
      `\n${count} non-canonical Tailwind classes. Run node scripts/check-tailwind-classes.mjs --fix to update them.`,
    );
    process.exitCode = 1;
  } else {
    console.log("Every Tailwind class uses its canonical name");
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
