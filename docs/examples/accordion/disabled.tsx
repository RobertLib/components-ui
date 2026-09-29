import { Accordion, AccordionGroup, Textarea } from "components-ui";

export default function Disabled() {
  return (
    <AccordionGroup collapsible defaultValue="notes">
      {/* Kept in the page while closed - the typed note stays */}
      <Accordion header="Notes" keepMounted value="notes">
        <Textarea label="Note for the courier" name="note" />
      </Accordion>
      <Accordion header="Gift wrapping" value="gift">
        Wrapped in recycled paper, with a card.
      </Accordion>
      {/* Cannot be opened - the arrow keys of the group skip it */}
      <Accordion
        disabled
        header="Express delivery (not available in your area)"
        value="express"
      >
        Delivery the next morning.
      </Accordion>
    </AccordionGroup>
  );
}
