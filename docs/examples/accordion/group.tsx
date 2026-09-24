import { Accordion, AccordionGroup } from "components-ui";

// One section open at a time - collapsible lets the open one close too
export default function Group() {
  return (
    <AccordionGroup collapsible defaultValue="billing">
      <Accordion
        header={<h3 className="font-semibold">Billing address</h3>}
        value="billing"
      >
        <p className="pt-3 text-sm">Nádražní 12, 602 00 Brno</p>
      </Accordion>
      <Accordion
        header={<h3 className="font-semibold">Shipping</h3>}
        value="shipping"
      >
        <p className="pt-3 text-sm">PPL parcel, delivered in 2 working days</p>
      </Accordion>
      <Accordion
        header={<h3 className="font-semibold">Payment</h3>}
        value="payment"
      >
        <p className="pt-3 text-sm">Bank transfer, due in 14 days</p>
      </Accordion>
    </AccordionGroup>
  );
}
