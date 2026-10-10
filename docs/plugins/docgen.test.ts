// @vitest-environment node
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { generateDocs } from "./docgen.ts";

it("documents the types of shared props in every union variant", () => {
  const directory = mkdtempSync(join(tmpdir(), "components-ui-docgen-"));
  try {
    mkdirSync(join(directory, "src"));
    writeFileSync(
      join(directory, "tsconfig.lib.json"),
      JSON.stringify({
        compilerOptions: { strict: true, types: [] },
        include: ["src"],
      }),
    );
    writeFileSync(
      join(directory, "src/index.ts"),
      `export type VariantProps =
  | {
      mode: "single";
      onChange: (value: string | null) => void;
      common?: boolean;
      singleOnly: number;
    }
  | {
      mode: "multiple";
      onChange: (value: string[]) => void;
      common?: boolean;
    };
`,
    );
    const { props } = generateDocs(directory).types.VariantProps;
    expect(props.find((prop) => prop.name === "onChange")).toMatchObject({
      type: "((value: string | null) => void) | ((value: string[]) => void)",
      required: true,
    });
    expect(props.find((prop) => prop.name === "mode")).toMatchObject({
      type: '"single" | "multiple"',
      required: true,
    });
    expect(props.find((prop) => prop.name === "common")).toMatchObject({
      type: "boolean",
      required: false,
    });
    expect(props.find((prop) => prop.name === "singleOnly")).toMatchObject({
      type: "number",
      required: false,
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it("includes both single and multiple AccordionGroup callback types", () => {
  const root = fileURLToPath(new URL("../..", import.meta.url));
  const { props } = generateDocs(root).types.AccordionGroupProps;
  expect(props.find((prop) => prop.name === "onValueChange")).toMatchObject({
    type: "((value: string | null) => void) | ((value: string[]) => void)",
    required: false,
  });
});
