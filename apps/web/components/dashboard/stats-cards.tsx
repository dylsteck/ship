"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: number | string;
  trend?: number[];
  className?: string;
}

function StatsCard({ title, value, trend, className }: StatsCardProps) {
  return (
    <Card className={cn("border-border bg-card", className)}>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground mb-1">{title}</div>
        <div className="text-2xl font-bold tracking-tight">{value.toLocaleString()}</div>
        {trend && trend.length > 0 && (
          <div className="mt-3 h-12 flex items-end gap-0.5">
            <MiniChart data={trend} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MiniChart({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const normalized = data.map((v) => (v / max) * 100);

  return (
    <svg viewBox={`0 0 ${data.length * 10} 48`} className="w-full h-full">
      <defs>
        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Area fill */}
      <path
        d={`
          M 0 48
          ${normalized.map((h, i) => `L ${i * 10 + 5} ${48 - h * 0.45}`).join(" ")}
          L ${(data.length - 1) * 10 + 5} 48
          Z
        `}
        fill="url(#chartGradient)"
        className="text-foreground"
      />

      {/* Line */}
      <path
        d={`M ${normalized.map((h, i) => `${i * 10 + 5} ${48 - h * 0.45}`).join(" L ")}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-foreground"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface StatsCardsProps {
  sessionCount: number;
  activeUsers: number;
  promptCount: number;
}

export function StatsCards({ sessionCount, activeUsers, promptCount }: StatsCardsProps) {
  // Generate fake trend data for demo (in real app, this would come from analytics)
  const generateTrend = (base: number, variance: number = 0.2) => {
    return Array.from({ length: 7 }, () =>
      Math.floor(base * (0.8 + Math.random() * variance * 2))
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatsCard
        title="Sessions past week"
        value={sessionCount}
        trend={generateTrend(sessionCount / 7)}
      />
      <StatsCard
        title="Active users"
        value={activeUsers}
        trend={generateTrend(activeUsers / 7)}
      />
      <StatsCard
        title="Prompts today"
        value={promptCount}
        trend={generateTrend(promptCount / 7)}
      />
    </div>
  );
}

export { StatsCard };
