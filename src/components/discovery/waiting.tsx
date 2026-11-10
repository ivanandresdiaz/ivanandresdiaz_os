/** Three dots while a Stakeholder screen loads. */
export function Waiting() {
  return (
    <div className="flex flex-1 items-center justify-center gap-1.5 py-24" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="thinking-dot size-2.5 rounded-full bg-accent" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  );
}
