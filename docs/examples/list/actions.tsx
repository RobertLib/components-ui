import { Pencil } from "lucide-react";
import {
  Avatar,
  Chip,
  IconButton,
  List,
  ListItem,
  useSnackbar,
} from "components-ui";

const people = [
  { club: "Karate Beroun", grade: "5th Kyu", name: "Jana Nováková" },
  { club: "Shotokan Hořovice", grade: "1st Dan", name: "Petr Svoboda" },
];

export default function Actions() {
  const { enqueueSnackbar } = useSnackbar();

  return (
    <div className="grid gap-8 md:grid-cols-2">
      {/* Rows with lines between them, in a section - controls beside */}
      <List aria-label="Trainers">
        {people.map((person) => (
          <ListItem
            actions={
              <IconButton
                aria-label={`Edit ${person.name}`}
                onClick={() => enqueueSnackbar(`Edit ${person.name}`)}
                tooltip
              >
                <Pencil size={16} />
              </IconButton>
            }
            description={person.club}
            key={person.name}
            start={<Avatar color="auto" name={person.name} size={40} />}
            title={person.name}
          />
        ))}
      </List>

      {/* Each row a card of its own - the accounts to pick from */}
      <List aria-label="Licences" variant="separate">
        {people.map((person) => (
          <ListItem
            description={person.club}
            end={<Chip color="primary">{person.grade}</Chip>}
            key={person.name}
            onClick={() => enqueueSnackbar(`Opened ${person.name}`)}
            start={<Avatar color="auto" name={person.name} size={48} />}
            title={person.name}
          />
        ))}
      </List>
    </div>
  );
}
