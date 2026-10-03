// Icons of the table tools in the style of Lucide, which has none for them
import { Grid2x2X, PanelTop } from "lucide-react";

interface IconProps {
  size?: number;
}

/** An icon in the style of Lucide - for the table tools it has none of. */
function TableIcon({
  children,
  size = 16,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
    >
      {children}
    </svg>
  );
}

export function RowAboveIcon(props: IconProps) {
  return (
    <TableIcon {...props}>
      <rect height="9" rx="2" width="18" x="3" y="12" />
      <path d="M3 16.5h18M12 2v7M8.5 5.5h7" />
    </TableIcon>
  );
}

export function RowBelowIcon(props: IconProps) {
  return (
    <TableIcon {...props}>
      <rect height="9" rx="2" width="18" x="3" y="3" />
      <path d="M3 7.5h18M12 15v7M8.5 18.5h7" />
    </TableIcon>
  );
}

export function ColumnLeftIcon(props: IconProps) {
  return (
    <TableIcon {...props}>
      <rect height="18" rx="2" width="9" x="12" y="3" />
      <path d="M16.5 3v18M2 12h7M5.5 8.5v7" />
    </TableIcon>
  );
}

export function ColumnRightIcon(props: IconProps) {
  return (
    <TableIcon {...props}>
      <rect height="18" rx="2" width="9" x="3" y="3" />
      <path d="M7.5 3v18M15 12h7M18.5 8.5v7" />
    </TableIcon>
  );
}

export function DeleteRowIcon(props: IconProps) {
  return (
    <TableIcon {...props}>
      <path d="M12 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1H3" />
      <path d="m16.5 16.5 5 5M16.5 21.5l5-5" />
    </TableIcon>
  );
}

export function DeleteColumnIcon(props: IconProps) {
  return (
    <TableIcon {...props}>
      <path d="M21 12V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6a1 1 0 0 0 1-1V3" />
      <path d="m16.5 16.5 5 5M16.5 21.5l5-5" />
    </TableIcon>
  );
}

export { Grid2x2X as DeleteTableIcon, PanelTop as HeaderRowIcon };
