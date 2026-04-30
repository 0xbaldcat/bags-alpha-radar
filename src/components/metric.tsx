type MetricProps = {
  label: string;
  value: string;
  detail?: string;
};

export function Metric({ label, value, detail }: MetricProps) {
  return (
    <div className="border border-ink/10 bg-white/70 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink/50">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {detail ? <div className="mt-1 text-sm text-ink/60">{detail}</div> : null}
    </div>
  );
}
