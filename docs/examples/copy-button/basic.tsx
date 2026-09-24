import { CopyButton, DescriptionList } from "components-ui";

const payment = {
  account: "CZ65 0800 0000 1920 0014 5399",
  amount: "8 400 CZK",
  reference: "20260042",
};

export default function Basic() {
  return (
    <DescriptionList
      items={[
        {
          desc: (
            <span className="inline-flex items-center gap-2">
              {payment.account}
              <CopyButton
                label="Copy the account number"
                value={payment.account}
              />
            </span>
          ),
          term: "Account",
        },
        {
          desc: (
            <span className="inline-flex items-center gap-2">
              {payment.reference}
              <CopyButton
                label="Copy the reference"
                value={payment.reference}
              />
            </span>
          ),
          term: "Reference",
        },
        { desc: payment.amount, term: "Amount" },
      ]}
    />
  );
}
