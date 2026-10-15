import { ButtonGroupContext } from "./button-group-context";
import { ReadOnlyContext } from "./form-scope";

/**
 * Sets back what the content of a dialog or a popover would take over from
 * where it opens, through the portal: the look of a `ButtonGroup`, and the
 * `readOnly` of a `FormGrid` or `FormSection` - its fields are another form.
 */
export default function PortalContexts({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ButtonGroupContext value={null}>
      <ReadOnlyContext value={undefined}>{children}</ReadOnlyContext>
    </ButtonGroupContext>
  );
}
