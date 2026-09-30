import { Skeleton } from "@/components/ui/misc";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-8 w-72" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="mt-6 h-80 rounded-2xl" />
    </div>
  );
}
