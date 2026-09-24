import { CircularProgress } from "components-ui";

export default function Circular() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-6">
        <CircularProgress aria-label="Profile completed" size="sm" value={40} />
        <CircularProgress aria-label="Storage used" showPercentage value={73} />
        <CircularProgress
          aria-label="Monthly quota"
          showPercentage
          size="lg"
          value={92}
          variant="warning"
        />
        <CircularProgress
          aria-label="Onboarding checklist"
          max={5}
          size="xl"
          strokeWidth={6}
          value={3}
          variant="success"
        >
          3/5
        </CircularProgress>
      </div>

      <div className="flex items-center gap-3 text-sm">
        {/* Without a value it spins */}
        <CircularProgress aria-label="Generating the report" size="sm" />
        Generating the report…
      </div>
    </div>
  );
}
