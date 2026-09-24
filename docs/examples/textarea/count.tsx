import { Textarea } from "components-ui";

export default function Count() {
  return (
    <div className="grid max-w-lg gap-5">
      <Textarea
        defaultValue="Thank you for your order."
        description="Printed on the invoice."
        label="Invoice note"
        maxLength={120}
        name="note"
        showCount
      />
      <Textarea autosize label="Internal notes" showCount />
    </div>
  );
}
