export function NoteCardSkeleton() {
  return (
    <div className="rounded-md border border-[var(--border)] bg-bg-surface p-4">
      <div className="shimmer mb-3 h-4 w-2/3 rounded" />
      <div className="shimmer mb-2 h-3 w-full rounded" />
      <div className="shimmer h-3 w-4/5 rounded" />
    </div>
  )
}

export function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <NoteCardSkeleton key={i} />
      ))}
    </div>
  )
}
