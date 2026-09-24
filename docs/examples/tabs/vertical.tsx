import { Bell, Lock, User } from "lucide-react";
import { useState } from "react";
import { Tabs, useIsMobile } from "components-ui";

const sections = [
  {
    icon: <User size={16} />,
    label: "Profile",
    text: "Name, e-mail and the language of the app.",
    value: "profile",
  },
  {
    icon: <Lock size={16} />,
    label: "Security",
    text: "Password and two-factor sign-in.",
    value: "security",
  },
  {
    icon: <Bell size={16} />,
    label: "Notifications",
    text: "Which e-mails and alerts you get.",
    value: "notifications",
  },
];

// A column beside the content - on phones a row above it
export default function VerticalTabs() {
  const [tab, setTab] = useState("profile");
  const isMobile = useIsMobile();
  const section = sections.find(({ value }) => value === tab) ?? sections[0];

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <Tabs
        aria-label="Settings"
        className="md:w-48"
        items={sections.map(({ icon, label, value }) => ({
          icon,
          id: `settings-tab-${value}`,
          label,
          panelId: "settings-panel",
          value,
        }))}
        onChange={setTab}
        orientation={isMobile ? "horizontal" : "vertical"}
        value={tab}
      />
      <div
        aria-labelledby={`settings-tab-${tab}`}
        className="flex-1 rounded-md border border-neutral-200 p-4 text-sm dark:border-neutral-800"
        id="settings-panel"
        role="tabpanel"
      >
        <h3 className="mb-1 font-semibold">{section.label}</h3>
        <p className="text-neutral-500 dark:text-neutral-400">{section.text}</p>
      </div>
    </div>
  );
}
