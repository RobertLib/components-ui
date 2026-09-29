import { useState } from "react";
import {
  SegmentedControl,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  type TableDensity,
} from "components-ui";

const people = [
  { email: "jana@example.com", name: "Jana Nováková", role: "Owner" },
  { email: "petr@example.com", name: "Petr Svoboda", role: "Editor" },
  { email: "eva@example.com", name: "Eva Malá", role: "Viewer" },
  { email: "karel@example.com", name: "Karel Dvořák", role: "Editor" },
];

const densities = [
  { label: "Compact", value: "compact" },
  { label: "Normal", value: "normal" },
  { label: "Comfortable", value: "comfortable" },
] satisfies { label: string; value: TableDensity }[];

export default function Options() {
  const [striped, setStriped] = useState(true);
  const [hover, setHover] = useState(true);
  const [bordered, setBordered] = useState(false);
  const [density, setDensity] = useState<TableDensity>("normal");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Switch
          checked={striped}
          label="Striped"
          onChange={(event) => setStriped(event.target.checked)}
        />
        <Switch
          checked={hover}
          label="Hover"
          onChange={(event) => setHover(event.target.checked)}
        />
        <Switch
          checked={bordered}
          label="Bordered"
          onChange={(event) => setBordered(event.target.checked)}
        />
        <SegmentedControl
          aria-label="Density"
          dim="sm"
          onChange={setDensity}
          options={densities}
          value={density}
        />
      </div>

      <Table
        aria-label="Members"
        bordered={bordered}
        density={density}
        hover={hover}
        striped={striped}
      >
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>Role</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {people.map((person) => (
            <TableRow key={person.email}>
              <TableCell header>{person.name}</TableCell>
              <TableCell>{person.email}</TableCell>
              <TableCell>{person.role}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
