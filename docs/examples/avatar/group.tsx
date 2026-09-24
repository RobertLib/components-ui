import { Avatar, AvatarGroup } from "components-ui";

const assignees = [
  "Jana Nováková",
  "Petr Svoboda",
  "Eva Malá",
  "Karel Dvořák",
  "Lucie Černá",
  "Tomáš Procházka",
];

export default function Group() {
  return (
    <div className="space-y-5">
      <AvatarGroup aria-label="Assignees" max={4} size="md">
        {assignees.map((name) => (
          <Avatar key={name} name={name} />
        ))}
      </AvatarGroup>

      {/* The API returned the first three members and the count of all */}
      <div className="flex items-center gap-3">
        <AvatarGroup aria-label="Team members" max={4} size="lg" total={24}>
          <Avatar name="Jana Nováková" status="online" />
          <Avatar name="Petr Svoboda" />
          <Avatar name="Eva Malá" status="away" />
        </AvatarGroup>
        <span className="text-sm text-neutral-600 dark:text-neutral-400">
          24 members
        </span>
      </div>

      <AvatarGroup aria-label="Reviewers">
        <Avatar name="Karel Dvořák" />
        <Avatar name="Lucie Černá" />
      </AvatarGroup>
    </div>
  );
}
