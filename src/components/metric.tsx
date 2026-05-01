import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

type MetricProps = {
  label: string;
  value: string;
  detail?: string;
  href?: string;
};

function MetricContent({ label, value, detail, href }: MetricProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink/50">{label}</div>
        {href ? <ArrowUpRight className="h-4 w-4 text-ink/35" /> : null}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {detail ? <div className="mt-1 text-sm text-ink/60">{detail}</div> : null}
    </>
  );
}

export function Metric(props: MetricProps) {
  const className = "block border border-ink/10 bg-white/70 p-4 transition hover:bg-white hover:shadow-line";

  if (props.href) {
    return (
      <Link href={props.href} className={className}>
        <MetricContent {...props} />
      </Link>
    );
  }

  return (
    <div className={className}>
      <MetricContent {...props} />
    </div>
  );
}
