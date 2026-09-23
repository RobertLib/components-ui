/** Shape of the `virtual:docgen` module - see docs/plugins/docgen.ts. */

export interface PropDoc {
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
  defaults: Record<string, string>;
  description: string;
}

export interface DocgenData {
  components: Record<string, ComponentDoc>;
  types: Record<string, TypeDoc>;
}
