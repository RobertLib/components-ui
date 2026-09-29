import {
  Table,
  TableBody,
  TableCell,
  TableFoot,
  TableHead,
  TableRow,
} from "components-ui";

const plans = [
  { name: "Basic", price: "$0", seats: "1", storage: "5 GB" },
  { name: "Team", price: "$12", seats: "10", storage: "100 GB" },
  { name: "Business", price: "$29", seats: "Unlimited", storage: "1 TB" },
];

export default function Basic() {
  return (
    <Table caption="Plans">
      <TableHead>
        <TableRow>
          <TableCell>Plan</TableCell>
          <TableCell>Seats</TableCell>
          <TableCell>Storage</TableCell>
          {/* Numbers at the end - their digits line up */}
          <TableCell align="end">Price per month</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {plans.map((plan) => (
          <TableRow key={plan.name}>
            {/* The header of its row - screen readers read it with the cells */}
            <TableCell header>{plan.name}</TableCell>
            <TableCell>{plan.seats}</TableCell>
            <TableCell>{plan.storage}</TableCell>
            <TableCell align="end">{plan.price}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFoot>
        <TableRow>
          <TableCell colSpan={4}>Prices without VAT</TableCell>
        </TableRow>
      </TableFoot>
    </Table>
  );
}
