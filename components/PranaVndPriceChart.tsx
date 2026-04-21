import React from 'react';
import { Activity } from 'lucide-react';
import { useElementSize } from '../hooks/useElementSize';
import { formatDate, formatDateTime, formatFullVnd } from '../utils/formatters';
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import type { PranaVndPriceChartProps, RangeKey } from '../types/charts';

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string }> = [
  { key: '30_days', label: '30D' },
  { key: '90_days', label: '90D' },
  { key: '180_days', label: '180D' },
  { key: '365_days', label: '1Y' },
  { key: 'max', label: 'MAX' },
];

const PranaVndPriceChart: React.FC<PranaVndPriceChartProps> = ({
  chartData,
  error,
  isLoading,
  selectedRange,
  onSelectRange,
}) => {
  const { ref: chartContainerRef, size: chartSize } = useElementSize<HTMLDivElement>();

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
      ) : isLoading ? (
        <div className="mt-4 text-sm text-gray-400">Loading...</div>
      ) : (
        <div ref={chartContainerRef} className="mt-5 h-64 w-full">
          {chartSize.width > 0 && chartSize.height > 0 ? (
            <LineChart width={chartSize.width} height={chartSize.height} data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(148, 163, 184, 0.2)" strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                type="number"
                domain={['dataMin', 'dataMax']}
                scale="time"
                tickFormatter={formatDate}
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                axisLine={{ stroke: "rgba(148, 163, 184, 0.3)" }}
                tickLine={{ stroke: "rgba(148, 163, 184, 0.3)" }}
              />
              <YAxis
                dataKey="price"
                tickFormatter={(value) => formatFullVnd(Number(value))}
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                axisLine={{ stroke: "rgba(148, 163, 184, 0.3)" }}
                tickLine={{ stroke: "rgba(148, 163, 184, 0.3)" }}
                domain={['auto', 'auto']}
                width={64}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(15, 23, 42, 0.95)",
                  border: "1px solid rgba(148, 163, 184, 0.3)",
                  borderRadius: "12px",
                  color: "#e2e8f0",
                }}
                labelFormatter={(value) => formatDateTime(Number(value))}
                formatter={(value) => [`${formatFullVnd(Number(value))} VND`, 'Price']}
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
              onClick={() => onSelectRange(option.key)}
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
