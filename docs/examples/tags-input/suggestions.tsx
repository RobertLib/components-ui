import { TagsInput } from "components-ui";

const skills = [
  "Accounting",
  "Budgeting",
  "Customer care",
  "Data analysis",
  "GraphQL",
  "Logistics",
  "Negotiation",
  "Project management",
  "React",
  "Recruiting",
  "Sales",
  "TypeScript",
  "Účetnictví",
];

export default function Suggestions() {
  return (
    <div className="max-w-md">
      <TagsInput
        defaultValue={["React"]}
        description="Pick from the list or type your own."
        label="Skills"
        name="skills"
        placeholder="Add a skill…"
        suggestions={skills}
      />
    </div>
  );
}
