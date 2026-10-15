import { useId } from "react";
import cn, { joinTokens } from "../../utils/cn";
import FormGrid, { type FormGridProps } from "./form-grid";

export interface FormSectionProps
  extends
    Omit<React.ComponentProps<"fieldset">, "title">,
    Pick<
      FormGridProps,
      "columns" | "labelPosition" | "labelWidth" | "readOnly"
    > {
  /**
   * Buttons at the end of the header, e.g. "Edit" or a menu. They are part
   * of the legend - they stay usable in a `disabled` section, as the
   * controls of a native legend do. Not with the `readOnly` of the section.
   */
  actions?: React.ReactNode;
  /** The fields, laid out by a `FormGrid` - see `columns`. */
  children?: React.ReactNode;
  /** Classes of the `<fieldset>`. */
  className?: string;
  /** A line under the title - it describes the group of the fields too. */
  description?: React.ReactNode;
  /**
   * Level of the heading of `title` - the level below the headings around.
   * @default 2
   */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  /** The heading of the section - also the name of its group of fields. */
  title?: React.ReactNode;
}

/** Whether a slot renders anything - the `false` of a condition does not. */
const hasContent = (node: React.ReactNode) =>
  node !== undefined && node !== null && node !== false && node !== "";

/**
 * A titled part of a form - a `<fieldset>` named by its heading, with a
 * description and actions, whose fields a `FormGrid` lays out: in
 * `columns`, with the labels above or beside the fields, all of them
 * read-only with `readOnly`. `disabled` disables them, as a native
 * fieldset does.
 */
export default function FormSection({
  actions,
  children,
  className,
  columns,
  description,
  headingLevel = 2,
  labelPosition,
  labelWidth,
  readOnly,
  title,
  ...props
}: FormSectionProps) {
  const id = useId();
  const Heading = `h${headingLevel}` as const;
  const hasTitle = hasContent(title);
  const hasDescription = hasContent(description);
  const hasActions = hasContent(actions);
  const titleId = `${id}-title`;
  const descriptionId = hasDescription ? `${id}-description` : undefined;

  const actionList = hasActions && (
    <span className="-my-1 flex shrink-0 flex-wrap items-center gap-2">
      {actions}
    </span>
  );

  return (
    <fieldset
      {...props}
      aria-describedby={joinTokens(descriptionId, props["aria-describedby"])}
      // The heading alone - the legend holds the actions too
      aria-labelledby={
        props["aria-labelledby"] ?? (hasTitle ? titleId : undefined)
      }
      className={cn("min-w-0", className)}
    >
      {hasTitle ? (
        // Floated, the legend is a block of the section - not drawn into
        // the border of the fieldset
        <legend
          className={cn("float-start w-full", hasDescription ? "mb-1" : "mb-4")}
        >
          <span className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <Heading
              className="min-w-0 font-heading text-section-title text-neutral-900 dark:text-neutral-50"
              id={titleId}
            >
              {title}
            </Heading>
            {actionList}
          </span>
        </legend>
      ) : (
        hasActions && (
          <div className="mb-4 flex flex-wrap justify-end gap-2">
            {actionList}
          </div>
        )
      )}
      {hasDescription && (
        <p
          className="clear-both mb-4 text-sm text-neutral-600 dark:text-neutral-400"
          id={descriptionId}
        >
          {description}
        </p>
      )}
      <FormGrid
        className="clear-both"
        columns={columns}
        labelPosition={labelPosition}
        labelWidth={labelWidth}
        readOnly={readOnly}
      >
        {children}
      </FormGrid>
    </fieldset>
  );
}
