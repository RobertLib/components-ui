import { Award, Images, NotebookPen, Stethoscope } from "lucide-react";
import { Chip, List, ListItem } from "components-ui";

// The sections of a record - each row a link, with a chevron
export default function Basic() {
  return (
    <nav aria-label="Licence" className="max-w-md">
      <List variant="framed">
        <ListItem
          description="5th Kyu · 12 Jun 2026"
          end={<Chip color="success">Passed</Chip>}
          href="#grades"
          icon={<Award />}
          title="Grades"
        />
        <ListItem
          description="Last on 3 Mar 2026"
          href="#medical"
          icon={<Stethoscope />}
          iconColor="info"
          title="Medical checks"
        />
        <ListItem
          description="2 records"
          href="#notes"
          icon={<NotebookPen />}
          iconColor="neutral"
          title="Notes"
        />
        <ListItem
          description="3 events"
          href="#gallery"
          icon={<Images />}
          iconColor="warning"
          title="Gallery"
        />
      </List>
    </nav>
  );
}
