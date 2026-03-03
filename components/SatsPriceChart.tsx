import { fetchJson } from "../utils/fetchJson";
import React, { useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { useElementSize } from "../hooks/useElementSize";

type SatsPoint = {
  t: number;
  p: number;
};

type ChartPoint = {
  time: number;
  price: number;
};

const MAX_POINTS = 150;

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

const SatsPriceChart: React.FC = () => {
  const [data, setData] = useState<SatsPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { ref: chartContainerRef, size: chartSize } = useElementSize<HTMLDivElement>();

  useEffect(() => {
    let isActive = true;

    const fetchData = async () => {
      try {
        const json = await fetchJson<SatsPoint[]>("/data_sats.json");
        if (!isActive) return;
        setData(Array.isArray(json) ? json : []);
        setError(null);
      } catch (err: any) {
        if (!isActive) return;
        const message =
          typeof err?.message === "string" && err.message.trim().length > 0
            ? err.message
            : "Failed to fetch data_sats.json";
        setError(message);
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    fetchData();

    return () => {
      isActive = false;
    };
  }, []);

  const { chartData, latest, min, max } = useMemo(() => {
    if (data.length === 0) {
      return { chartData: [] as ChartPoint[], latest: null, min: null, max: null };
    }

    const sorted = [...data].sort((a, b) => a.t - b.t);
    const step = Math.max(1, Math.ceil(sorted.length / MAX_POINTS));
    const sampled = sorted.filter((_, index) => index % step === 0 || index === sorted.length - 1);

    let minValue = Infinity;
    let maxValue = -Infinity;

    for (const point of sorted) {
      if (point.p < minValue) minValue = point.p;
      if (point.p > maxValue) maxValue = point.p;
    }

    const chartData = sampled.map((point) => ({
      time: point.t * 1000,
      price: point.p,
    }));

    const latestPoint = sorted[sorted.length - 1];

    return {
      chartData,
      latest: latestPoint?.p ?? null,
      min: Number.isFinite(minValue) ? minValue : null,
      max: Number.isFinite(maxValue) ? maxValue : null,
    };
  }, [data]);

  return (
    <div className="h-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md px-5 py-4 flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-amber-300" />
            <div className="text-sm font-medium text-gray-400 uppercase tracking-wider">PRANA/SAT</div>
          </div>
        </div>

        {error ? (
          <div className="mt-4 text-sm text-red-200">{error}</div>
        ) : (
          <div ref={chartContainerRef} className="mt-6 h-64 w-full">
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
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                  axisLine={{ stroke: "rgba(148, 163, 184, 0.3)" }}
                  tickLine={{ stroke: "rgba(148, 163, 184, 0.3)" }}
                  domain={["auto", "auto"]}
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(15, 23, 42, 0.95)",
                    border: "1px solid rgba(148, 163, 184, 0.3)",
                    borderRadius: "12px",
                    color: "#e2e8f0",
                  }}
                  labelFormatter={(value) => formatDateTime(Number(value))}
                  formatter={(value) => [`${Number(value).toFixed(2)} SAT`, "Price"]}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            ) : null}
          </div>
        )}
      </div>
  );
};

export default SatsPriceChart;
