import { describe, expect, it } from "vitest";
import cn, { joinTokens } from "./cn";

describe("cn", () => {
  it("joins strings, numbers, arrays and objects and skips falsy values", () => {
    expect(
      cn("px-2", 1, false, null, undefined, ["a", ["b"]], {
        c: true,
        d: false,
      }),
    ).toBe("px-2 1 a b c");
  });

  it("returns undefined when there is no class", () => {
    expect(cn()).toBeUndefined();
    expect(cn(undefined, false, "", {})).toBeUndefined();
  });

  it("collapses whitespace and repeated classes", () => {
    expect(cn("a b", "b\na")).toBe("b a");
  });

  it("keeps the later of two classes that set the same property", () => {
    expect(cn("mb-6", "mb-0")).toBe("mb-0");
    expect(cn("p-6", "p-0")).toBe("p-0");
    expect(cn("rounded-md", "rounded-full")).toBe("rounded-full");
    expect(cn("h-4 w-4", "w-full")).toBe("h-4 w-full");
    expect(cn("hidden", "flex")).toBe("flex");
    expect(cn("absolute", "relative")).toBe("relative");
    expect(cn("-mt-px", "mt-2")).toBe("mt-2");
    expect(cn("z-10", "z-[60]")).toBe("z-[60]");
    expect(cn("transition-all", "transition-colors")).toBe("transition-colors");
    expect(cn("font-medium", "font-bold")).toBe("font-bold");
    expect(cn("max-w-md", "max-w-[90vw]")).toBe("max-w-[90vw]");
  });

  it("lets a later shorthand replace its parts, not the other way round", () => {
    expect(cn("px-3 py-1", "p-0")).toBe("p-0");
    expect(cn("p-4", "px-0")).toBe("p-4 px-0");
    expect(cn("pr-2 pl-2", "px-4")).toBe("px-4");
    expect(cn("h-4 w-4", "size-5")).toBe("size-5");
    expect(cn("size-5", "w-4")).toBe("size-5 w-4");
    expect(cn("top-0 left-0", "inset-2")).toBe("inset-2");
    expect(cn("rounded-t-md rounded-bl-lg", "rounded-none")).toBe(
      "rounded-none",
    );
    expect(cn("rounded-md", "rounded-l-none")).toBe(
      "rounded-md rounded-l-none",
    );
    expect(cn("border-t-2", "border")).toBe("border");
    expect(cn("gap-x-2", "gap-4")).toBe("gap-4");
    expect(cn("overflow-x-auto", "overflow-hidden")).toBe("overflow-hidden");
  });

  it("tells sizes from colors and other properties of one prefix", () => {
    expect(cn("text-sm text-neutral-700", "text-danger-600")).toBe(
      "text-sm text-danger-600",
    );
    expect(cn("text-sm text-white", "text-lg")).toBe("text-white text-lg");
    expect(cn("text-sm/6", "text-xs")).toBe("text-xs");
    expect(cn("text-left text-white", "text-center")).toBe(
      "text-white text-center",
    );
    expect(cn("text-[0.9em] text-[#333]", "text-base")).toBe(
      "text-[#333] text-base",
    );
    expect(cn("bg-primary-600 bg-linear-to-r", "bg-transparent")).toBe(
      "bg-linear-to-r bg-transparent",
    );
    expect(cn("bg-surface", "bg-background")).toBe("bg-background");
    expect(cn("border border-primary-500/40", "border-[1.5px]")).toBe(
      "border-primary-500/40 border-[1.5px]",
    );
    expect(cn("border-solid border-neutral-300", "border-transparent")).toBe(
      "border-solid border-transparent",
    );
    expect(cn("border-l-4 border-l-neutral-300", "border-l-danger-500")).toBe(
      "border-l-4 border-l-danger-500",
    );
    expect(cn("ring-2 ring-primary-500", "ring-danger-500")).toBe(
      "ring-2 ring-danger-500",
    );
    expect(cn("ring-offset-2 ring-offset-surface", "ring-offset-0")).toBe(
      "ring-offset-surface ring-offset-0",
    );
    expect(cn("shadow-lg shadow-primary-500/20", "shadow-none")).toBe(
      "shadow-primary-500/20 shadow-none",
    );
    expect(cn("from-primary-600 to-primary-700", "from-danger-600")).toBe(
      "to-primary-700 from-danger-600",
    );
    expect(cn("flex flex-1 flex-col flex-wrap", "flex-row")).toBe(
      "flex flex-1 flex-wrap flex-row",
    );
    expect(cn("justify-between justify-items-center", "justify-end")).toBe(
      "justify-items-center justify-end",
    );
    expect(cn("font-mono font-bold", "font-sans")).toBe("font-bold font-sans");
    // The color of a text shadow is not that of the text
    expect(cn("text-neutral-900", "text-shadow-sky-300")).toBe(
      "text-neutral-900 text-shadow-sky-300",
    );
    expect(cn("text-sm", "text-shadow-lg")).toBe("text-sm text-shadow-lg");
    // The shadow and its color of their own
    expect(cn("text-shadow-sky-300", "text-shadow-red-500/50")).toBe(
      "text-shadow-red-500/50",
    );
    expect(cn("text-shadow-md text-shadow-sky-300", "text-shadow-lg/20")).toBe(
      "text-shadow-sky-300 text-shadow-lg/20",
    );
    expect(cn("text-shadow-lg", "text-shadow-none")).toBe("text-shadow-none");
  });

  it("merges only classes under the same variants", () => {
    expect(cn("p-2 md:p-4", "p-0")).toBe("md:p-4 p-0");
    expect(cn("hover:bg-neutral-50", "bg-danger-50")).toBe(
      "hover:bg-neutral-50 bg-danger-50",
    );
    expect(cn("dark:hover:bg-neutral-800", "hover:dark:bg-neutral-700")).toBe(
      "hover:dark:bg-neutral-700",
    );
    expect(cn("[&>svg]:size-4", "[&>svg]:size-5")).toBe("[&>svg]:size-5");
    expect(cn("data-[state=open]:p-2", "p-4")).toBe(
      "data-[state=open]:p-2 p-4",
    );
  });

  it("keeps the order of the variants that move to other elements", () => {
    // A hovered child, the children of a hovered element
    expect(cn("*:hover:p-2", "hover:*:p-4")).toBe("*:hover:p-2 hover:*:p-4");
    expect(cn("[&>svg]:hover:p-2", "hover:[&>svg]:p-4")).toBe(
      "[&>svg]:hover:p-2 hover:[&>svg]:p-4",
    );
    expect(cn("before:hover:p-2", "hover:before:p-4")).toBe(
      "before:hover:p-2 hover:before:p-4",
    );
    // Around them, the order of the others still does not matter
    expect(cn("dark:hover:*:p-2", "hover:dark:*:p-4")).toBe("hover:dark:*:p-4");
    expect(cn("*:md:hover:p-2", "*:hover:md:p-4")).toBe("*:hover:md:p-4");
    // A query selects no other element - it applies wherever it stands
    expect(cn("md:*:p-2", "*:md:p-4")).toBe("*:md:p-4");
    expect(cn("md:before:p-2", "before:md:p-4")).toBe("before:md:p-4");
    expect(cn("md:[&>svg]:size-4", "[&>svg]:md:size-5")).toBe(
      "[&>svg]:md:size-5",
    );
    // `dark` may be a class - after a pseudo-element it would select nothing
    expect(
      cn("dark:placeholder:text-neutral-400", "placeholder:dark:text-red-400"),
    ).toBe("dark:placeholder:text-neutral-400 placeholder:dark:text-red-400");
    expect(cn("dark:*:text-white", "*:dark:text-black")).toBe(
      "dark:*:text-white *:dark:text-black",
    );
    expect(cn("[@media(hover:none)]:*:p-2", "*:[@media(hover:none)]:p-4")).toBe(
      "*:[@media(hover:none)]:p-4",
    );
    // Nor does an arbitrary variant with nothing after its `&`
    expect(
      cn("[fieldset:disabled_&]:hover:p-2", "hover:[fieldset:disabled_&]:p-4"),
    ).toBe("hover:[fieldset:disabled_&]:p-4");
    expect(cn("[&_p]:hover:p-2", "hover:[&_p]:p-4")).toBe(
      "[&_p]:hover:p-2 hover:[&_p]:p-4",
    );
  });

  it("keeps important classes apart from plain ones", () => {
    expect(cn("p-2!", "p-4")).toBe("p-2! p-4");
    expect(cn("!p-2", "p-4!")).toBe("p-4!");
  });

  it("keeps every class it cannot be sure about", () => {
    expect(cn("form-control px-2", "px-4")).toBe("form-control px-4");
    expect(cn("btn", "btn-group", "rich-text")).toBe("btn btn-group rich-text");
    expect(cn("text-brand", "text-sm")).toBe("text-brand text-sm");
    expect(cn("text-(--muted)", "text-danger-600")).toBe(
      "text-(--muted) text-danger-600",
    );
    expect(cn("bg-cover bg-center", "bg-primary-500")).toBe(
      "bg-cover bg-center bg-primary-500",
    );
    expect(cn("space-x-2 space-x-reverse", "space-x-4")).toBe(
      "space-x-reverse space-x-4",
    );
    expect(cn("truncate", "whitespace-normal")).toBe(
      "truncate whitespace-normal",
    );
    expect(cn("outline", "outline-none")).toBe("outline outline-none");
    expect(cn("group peer", "group/item")).toBe("group peer group/item");
    expect(cn("w-[calc(100%-2rem)]", "w-full")).toBe("w-full");
  });

  it("keeps custom classes that only look like a utility", () => {
    expect(cn("absolute left-0", "left-panel")).toBe(
      "absolute left-0 left-panel",
    );
    expect(cn("top-0", "top-bar")).toBe("top-0 top-bar");
    expect(cn("size-4", "size-hint")).toBe("size-4 size-hint");
    expect(cn("items-center", "items-list")).toBe("items-center items-list");
    expect(cn("rounded-md", "rounded-card")).toBe("rounded-md rounded-card");
    expect(cn("flex-1", "flex-panel")).toBe("flex-1 flex-panel");
    expect(cn("overflow-hidden", "overflow-wrapper")).toBe(
      "overflow-hidden overflow-wrapper",
    );
    expect(cn("z-10", "z-index")).toBe("z-10 z-index");
    expect(cn("justify-between", "justify-me")).toBe(
      "justify-between justify-me",
    );
  });
});

describe("joinTokens", () => {
  it("joins ids and rel values without merging or dropping any", () => {
    expect(joinTokens("size-error", undefined, "size-hint")).toBe(
      "size-error size-hint",
    );
    expect(joinTokens("p-1", "p-2", "p-1")).toBe("p-1 p-2 p-1");
    expect(joinTokens(undefined, false, "")).toBeUndefined();
  });
});
