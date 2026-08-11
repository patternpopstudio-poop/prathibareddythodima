export default function AppLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="space-y-3">
        <div className="h-9 w-56 rounded-2xl bg-border/70" />
        <div className="h-4 w-72 max-w-full rounded-xl bg-border/50" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-24 rounded-[24px] bg-border/40" />
        <div className="h-24 rounded-[24px] bg-border/40" />
        <div className="h-24 rounded-[24px] bg-border/40" />
      </div>
      <div className="h-64 rounded-[24px] bg-border/30" />
    </div>
  );
}
