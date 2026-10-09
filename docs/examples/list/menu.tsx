import { useState } from "react";
import { Award, IdCard, Images, LogOut } from "lucide-react";
import { List, ListItem } from "components-ui";

const pages = [
  { icon: <IdCard />, id: "licence", title: "Licence" },
  { icon: <Award />, id: "grades", title: "Grades" },
  { icon: <Images />, id: "gallery", title: "Gallery" },
];

// A menu - rows without lines, the current page highlighted
export default function Menu() {
  const [current, setCurrent] = useState("licence");

  return (
    <nav aria-label="Menu" className="max-w-xs">
      <List size="md" variant="plain">
        {pages.map((page) => (
          <ListItem
            chevron={false}
            current={page.id === current}
            icon={page.icon}
            iconColor={page.id === current ? "primary" : "neutral"}
            key={page.id}
            onClick={() => setCurrent(page.id)}
            title={page.title}
          />
        ))}
        <ListItem
          chevron={false}
          icon={<LogOut />}
          iconColor="danger"
          onClick={() => {}}
          title="Sign out"
        />
      </List>
    </nav>
  );
}
