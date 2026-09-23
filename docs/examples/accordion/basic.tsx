import { Accordion } from "components-ui";

export default function Basic() {
  return (
    <div className="space-y-3">
      <Accordion header={<h3 className="font-semibold">Billing address</h3>}>
        <p className="pt-3 text-sm">Nádražní 12, 602 00 Brno</p>
      </Accordion>
      <Accordion
        header={<h3 className="font-semibold">Order history</h3>}
        defaultOpen={false}
      >
        <p className="pt-3 text-sm">
          Starts collapsed - click the header to open it.
        </p>
      </Accordion>
    </div>
  );
}
