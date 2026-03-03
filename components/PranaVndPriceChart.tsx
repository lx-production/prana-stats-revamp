import { fetchJson } from "../utils/fetchJson";
import React, { useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { useElementSize } from "../hooks/useElementSize";

type PricePoint = {
  t: number;
  p: number;
};

type ChartPoint = {
  time: number;
  price: number;
};

type RangeKey = "7_days" | "30_days" | "90_days" | "180_days" | "365_days" | "max";

const USD_TO_VND_FALLBACK = 26000;
const MAX_POINTS = 150;
const RANGE_OPTIONS: Array<{ key: RangeKey; label: string; file: string }> = [
  { key: "30_days", label: "30D", file: "/data_30_days.json" },
  { key: "90_days", label: "90D", file: "/data_90_days.json" },
  { key: "180_days", label: "180D", file: "/data_180_days.json" },
  { key: "365_days", label: "1Y", file: "/data_365_days.json" },
  { key: "max", label: "MAX", file: "/data_max.json" },
];

const formatDate = (value: number) =>
  new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const formatDateTime = (value: number) =>
  new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatCompactVnd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

const formatFullVnd = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);

const PranaVndPriceChart: React.FC = () => {
  const [selectedRange, setSelectedRange] = useState<RangeKey>("365_days");
  const [rangeData, setRangeData] = useState<Partial<Record<RangeKey, PricePoint[]>>>({});
  const [usdToVndRate, setUsdToVndRate] = useState<number>(USD_TO_VND_FALLBACK);
  const [error, setError] = useState<string | null>(null);
  const { ref: chartContainerRef, size: chartSize } = useElementSize<HTMLDivElement>();

  useEffect(() => {
    let isActive = true;

    const loadRate = async () => {
      try {
        const rateData = await fetchJson<{ rates?: { VND?: number } }>("https://api.exchangerate-api.com/v4/latest/USD", undefined, {
          dedupeKey: "usd-vnd-rate",
        });
        const nextRate = rateData?.rates?.VND;
        if (!isActive) return;
        if (typeof nextRate === "number" && Number.isFinite(nextRate) && nextRate > 0) {
          setUsdToVndRate(nextRate);
        }
      } catch {
        if (isActive) {
          setUsdToVndRate(USD_TO_VND_FALLBACK);
        }
      }
    };

    loadRate();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (rangeData[selectedRange]) return;

    let isActive = true;

    const loadRangeData = async () => {
      const option = RANGE_OPTIONS.find((item) => item.key === selectedRange);
      if (!option) return;

      try {
        const json = await fetchJson<PricePoint[]>(option.file);
        if (!isActive) return;
        setRangeData((prev) => ({
          ...prev,
          [selectedRange]: Array.isArray(json) ? json : [],
        }));
        setError(null);
      } catch (err: any) {
        if (!isActive) return;
        const message =
          typeof err?.message === "string" && err.message.trim().length > 0
            ? err.message
            : `Failed to fetch ${option.file}`;
        setError(message);
      }
    };

    loadRangeData();

    return () => {
      isActive = false;
    };
  }, [selectedRange, rangeData]);

  const rawData = rangeData[selectedRange] ?? [];

  const { chartData, latest } = useMemo(() => {
    if (rawData.length === 0) {
      return { chartData: [] as ChartPoint[], latest: null as number | null };
    }

    const sorted = [...rawData].sort((a, b) => a.t - b.t);
    const step = Math.max(1, Math.ceil(sorted.length / MAX_POINTS));
    const sampled = sorted.filter((_, index) => index % step === 0 || index === sorted.length - 1);
    const points = sampled.map((point) => ({
      time: point.t * 1000,
      price: Math.round(point.p * usdToVndRate),
    }));

    const latestPoint = sorted[sorted.length - 1];

    return {
      chartData: points,
      latest: Math.round(latestPoint.p * usdToVndRate),
    };
  }, [rawData, usdToVndRate]);

  return (
    <div className="h-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md px-5 py-4 flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-300" />
          <div className="text-sm font-medium text-gray-400 uppercase tracking-wider">PRANA/VND</div>
        </div>
      </div>

      {error ? (
        <div className="mt-4 text-sm text-red-200">{error}</div>
      ) : (
        <div ref={chartContainerRef} className="mt-5 h-64 w-full">
          {chartSize.width > 0 && chartSize.height > 0 ? (
            <LineChart width={chartSize.width} height={chartSize.height} data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(148, 163, 184, 0.2)" strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                type="number"
                domain={["dataMin", "dataMax"]}
                scale="time"
                tickFormatter={formatDate}
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                axisLine={{ stroke: "rgba(148, 163, 184, 0.3)" }}
                tickLine={{ stroke: "rgba(148, 163, 184, 0.3)" }}
              />
              <YAxis
                dataKey="price"
                tickFormatter={(value) => formatCompactVnd(Number(value))}
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                axisLine={{ stroke: "rgba(148, 163, 184, 0.3)" }}
                tickLine={{ stroke: "rgba(148, 163, 184, 0.3)" }}
                domain={["auto", "auto"]}
                width={56}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(15, 23, 42, 0.95)",
                  border: "1px solid rgba(148, 163, 184, 0.3)",
                  borderRadius: "12px",
                  color: "#e2e8f0",
                }}
                labelFormatter={(value) => formatDateTime(Number(value))}
                formatter={(value) => [`${formatFullVnd(Number(value))} VND`, "Price"]}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#4ade80"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </LineChart>
          ) : null}
        </div>
      )}
      
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {RANGE_OPTIONS.map((option) => {
          const isSelected = option.key === selectedRange;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => setSelectedRange(option.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                isSelected
                  ? "bg-emerald-400/20 text-emerald-200 border border-emerald-300/40"
                  : "bg-white/5 text-gray-300 border border-white/15 hover:bg-white/10"
              }`}
              aria-pressed={isSelected}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PranaVndPriceChart;
