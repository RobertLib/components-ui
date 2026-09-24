import { Avatar } from "components-ui";

const photo =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#fcd34d"/><circle cx="32" cy="26" r="12" fill="#92400e"/><rect x="12" y="42" width="40" height="30" rx="15" fill="#92400e"/></svg>`,
  );

export default function Basic() {
  return (
    <div className="flex flex-wrap items-center gap-6">
      <Avatar name="Jana Nováková" size="lg" src={photo} />
      <Avatar name="Jana Nováková" size="lg" />
      <Avatar size="lg" />
      {/* A picture that fails to load falls back to the initials - here one
          that is no image at all, so the demo needs no failing request */}
      <Avatar name="Broken Image" size="lg" src="data:," />
      <div className="flex items-center gap-2">
        <Avatar name="Small" size="sm" />
        <Avatar name="Medium" size="md" />
        <Avatar name="Large" size="lg" />
        <Avatar name="Extra Large" size="xl" />
      </div>
    </div>
  );
}
