import { useState } from "react";
import { Accordion, AccordionGroup, Button } from "components-ui";

const sections = [
  {
    text: "Name, VAT ID and the registered office.",
    title: "Company",
    value: "company",
  },
  {
    text: "Who approves orders over 50 000 CZK.",
    title: "Approvals",
    value: "approvals",
  },
  {
    text: "Invoice numbering and the due period.",
    title: "Invoicing",
    value: "invoicing",
  },
];

// Any sections open - controlled, so buttons can open and close them all
export default function GroupMultiple() {
  const [open, setOpen] = useState(["company"]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          onClick={() => setOpen(sections.map(({ value }) => value))}
          size="sm"
          variant="outline"
        >
          Expand all
        </Button>
        <Button onClick={() => setOpen([])} size="sm" variant="outline">
          Collapse all
        </Button>
      </div>
      <AccordionGroup onValueChange={setOpen} type="multiple" value={open}>
        {sections.map(({ text, title, value }) => (
          <Accordion
            header={<h3 className="font-semibold">{title}</h3>}
            key={value}
            value={value}
          >
            <p className="pt-3 text-sm">{text}</p>
          </Accordion>
        ))}
      </AccordionGroup>
    </div>
  );
}
