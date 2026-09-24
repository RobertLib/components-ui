/** Shape of the `virtual:docgen` module - see docs/plugins/docgen.ts. */

export interface PropDoc {
  /**
   * The default of the prop destructured by the function taking the type
   * (`Button` for `ButtonProps`), or else its `@default` JSDoc tag.
   */
  defaultValue?: string;
  description: string;
  name: string;
  required: boolean;
  type: string;
}

export interface TypeDoc {
  description: string;
  /** Props inherited from React / the DOM, e.g. `React.ComponentProps<"div">`. */
  extends: string[];
  props: PropDoc[];
}

export interface ComponentDoc {
  description: string;
}

export interface DocgenData {
  /** The exported functions and classes - components, hooks and helpers. */
  components: Record<string, ComponentDoc>;
  types: Record<string, TypeDoc>;
}
