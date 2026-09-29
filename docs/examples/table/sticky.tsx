import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "components-ui";

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const regions = ["Prague", "Brno", "Ostrava", "Plzeň", "Liberec", "Olomouc"];

// A made-up figure of a month and a region
const sales = (month: number, region: number) =>
  ((month + 3) * (region + 5) * 37) % 900;

export default function Sticky() {
  return (
    // Higher than 18rem, it scrolls in its frame - the header stays. Wider
    // than a phone, it scrolls sideways.
    <Table
      caption="Sales by region"
      density="compact"
      maxHeight="18rem"
      stickyHeader
      striped
    >
      <TableHead>
        <TableRow>
          <TableCell>Month</TableCell>
          {regions.map((region) => (
            <TableCell align="end" className="whitespace-nowrap" key={region}>
              {region}
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {months.map((month, monthIndex) => (
          <TableRow key={month}>
            <TableCell header>{month}</TableCell>
            {regions.map((region, regionIndex) => (
              <TableCell align="end" className="tabular-nums" key={region}>
                {sales(monthIndex, regionIndex)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
