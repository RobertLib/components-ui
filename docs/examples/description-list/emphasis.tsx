import { DescriptionList } from "components-ui";

export default function Emphasis() {
  return (
    <DescriptionList
      columns={2}
      emphasis="desc"
      emptyValue="—"
      items={[
        { desc: "Jana", term: "First name" },
        { desc: "Nováková", term: "Last name" },
        { desc: "12 Mar 2014, Beroun", term: "Born" },
        { desc: null, term: "Address" },
        { desc: "jana@example.com (parent)", term: "E-mail" },
        { desc: "Karate Beroun", descClassName: "font-medium", term: "Club" },
      ]}
    />
  );
}
