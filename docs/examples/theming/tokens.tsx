const scales = [
  "primary",
  "secondary",
  "success",
  "danger",
  "warning",
  "info",
  "neutral",
];
const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

// The color tokens of the library - every class like bg-primary-500 or
// text-danger-600 reads one of these CSS variables
export default function Tokens() {
  return (
    <div className="space-y-2 overflow-x-auto">
      {scales.map((scale) => (
        <div className="flex min-w-[560px] items-center gap-2" key={scale}>
          <div className="w-20 shrink-0 text-xs font-medium">{scale}</div>
          {shades.map((shade) => (
            <div
              className="h-8 flex-1 rounded"
              key={shade}
              style={{ background: `var(--color-${scale}-${shade})` }}
              title={`--color-${scale}-${shade}`}
            />
          ))}
        </div>
      ))}
      <div className="flex min-w-[560px] items-center gap-2 pt-2 text-xs">
        <div className="w-20 shrink-0" />
        {shades.map((shade) => (
          <div
            className="flex-1 text-center text-neutral-500 dark:text-neutral-400"
            key={shade}
          >
            {shade}
          </div>
        ))}
      </div>
    </div>
  );
}
