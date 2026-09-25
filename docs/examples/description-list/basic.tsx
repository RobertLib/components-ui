import { Chip, DescriptionList, Link } from "components-ui";

export default function Basic() {
  return (
    <DescriptionList
      items={[
        { desc: "Jana Nováková", term: "Name" },
        {
          desc: <Link href="mailto:jana@example.com">jana@example.com</Link>,
          term: "Email",
        },
        { desc: <Chip color="success">Active</Chip>, term: "Status" },
        {
          desc: "12 500 CZK",
          term: "Credit",
          termInfo: "Unpaid invoices are deducted from the credit.",
        },
        {
          desc: "a-very-long-unbreakable-file-name-that-wraps-inside-its-cell.pdf",
          term: "Contract",
        },
      ]}
    />
  );
}
