import React from 'react';
import { Activity } from 'lucide-react';
import { useElementSize } from '../hooks/useElementSize';
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import type { SatsPriceChartProps } from '../types/satsChart';

const formatDate = (value: number) =>
  new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const formatDateTime = (value: number) =>
  new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const SatsPriceChart: React.FC<SatsPriceChartProps> = ({ chartData, error, isLoading }) => {
  const { ref: chartContainerRef, size: chartSize } = useElementSize<HTMLDivElement>();

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
        ) : isLoading ? (
          <div className="mt-4 text-sm text-gray-400">Loading...</div>
        ) : (
          <div ref={chartContainerRef} className="mt-6 h-64 w-full">
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
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                  axisLine={{ stroke: "rgba(148, 163, 184, 0.3)" }}
                  tickLine={{ stroke: "rgba(148, 163, 184, 0.3)" }}
                  domain={['auto', 'auto']}
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
                  formatter={(value) => [`${Number(value).toFixed(2)} SAT`, 'Price']}
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
