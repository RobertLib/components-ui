import { Skeleton, Spinner } from "components-ui";

export default function Basic() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6">
        <Spinner size="sm" />
        <Spinner size="md" />
        <Spinner size="lg" />
        <Spinner size="xl" />
        {/* The spinner takes the text color */}
        <Spinner className="text-primary-500" size="lg" />
        <Spinner
          aria-label="Loading orders"
          className="text-danger-500"
          size="lg"
        />
      </div>

      {/* Skeletons keep the layout while the content loads */}
      <div className="flex max-w-sm items-center gap-3">
        <Skeleton className="rounded-full" height="h-12" width="w-12" />
        <div className="flex-1 space-y-2">
          <Skeleton width="w-2/3" />
          <Skeleton height="h-3" width="w-1/2" />
        </div>
      </div>
    </div>
  );
}
