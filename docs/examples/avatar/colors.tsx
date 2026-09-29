import { Avatar, AvatarGroup } from "components-ui";

const people = [
  "Jana Nováková",
  "Petr Svoboda",
  "Eva Malá",
  "Karel Dvořák",
  "Lucie Černá",
  "Tomáš Procházka",
];

export default function Colors() {
  return (
    <div className="space-y-6">
      {/* The same name always gets the same color */}
      <div className="flex flex-wrap items-center gap-3">
        {people.map((name) => (
          <Avatar color="auto" key={name} name={name} size="lg" />
        ))}
      </div>

      {/* Rounded squares - for companies, projects, workspaces */}
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name="Acme Corporation" shape="square" size="lg" />
        <Avatar color="success" name="Green Energy" shape="square" size="lg" />
        <Avatar
          color="auto"
          name="Northwind"
          shape="square"
          size="lg"
          status="busy"
        />
        <AvatarGroup max={3} shape="square" size="md">
          <Avatar color="auto" name="Website" />
          <Avatar color="auto" name="Mobile app" />
          <Avatar color="auto" name="Billing" />
          <Avatar color="auto" name="Support" />
        </AvatarGroup>
      </div>
    </div>
  );
}
