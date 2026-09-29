import {
  Sparkline,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "components-ui";

const products = [
  { name: "Coffee beans", sales: [120, 132, 128, 140, 151, 149, 160] },
  { name: "Tea", sales: [80, 78, 82, 75, 70, 72, 68] },
  // No sales on two days - a gap in the line
  { name: "Cocoa", sales: [20, 24, null, null, 30, 34, 31] },
];

// One scale for all rows - their lines can be compared
const max = Math.max(...products.flatMap(({ sales }) => sales.map(Number)));

export default function InATable() {
  return (
    <Table caption="Sales of the last week" density="compact">
      <TableHead>
        <TableRow>
          <TableCell>Product</TableCell>
          <TableCell>Trend</TableCell>
          <TableCell align="end">Last day</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {products.map((product) => (
          <TableRow key={product.name}>
            <TableCell header>{product.name}</TableCell>
            <TableCell>
              <Sparkline
                area
                data={product.sales}
                formatOptions={{ style: "unit", unit: "kilogram" }}
                label={`Sales of ${product.name}`}
                max={max}
                min={0}
              />
            </TableCell>
            <TableCell align="end" className="tabular-nums">
              {product.sales.at(-1)} kg
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
