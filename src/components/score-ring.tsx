import { cn } from "@/lib/utils";

type ScoreRingProps = {
  score: number | null;
  size?: "sm" | "md" | "lg";
};

export function ScoreRing({ score, size = "md" }: ScoreRingProps) {
  const dimensions = {
    sm: "h-12 w-12 text-sm",
    md: "h-16 w-16 text-lg",
    lg: "h-24 w-24 text-3xl"
  }[size];
  const color = score === null ? "#121417" : score >= 75 ? "#1d8f63" : score >= 50 ? "#d89a25" : "#c94c3d";

  return (
    <div
      className={cn("grid shrink-0 place-items-center rounded-full font-semibold text-ink", dimensions)}
      style={{
        background: score === null
          ? "rgba(18, 20, 23, 0.08)"
          : `conic-gradient(${color} ${score * 3.6}deg, rgba(18, 20, 23, 0.1) 0deg)`
      }}
    >
      <div className="grid h-[78%] w-[78%] place-items-center rounded-full bg-panel shadow-line">
        {score ?? "--"}
      </div>
    </div>
  );
}
