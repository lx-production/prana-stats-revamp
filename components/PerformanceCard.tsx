import React from 'react';
import { Activity, ArrowDown, ArrowUp } from 'lucide-react';
import type { PerformanceCardProps } from '../types/performance';

const PerformanceCard: React.FC<PerformanceCardProps> = ({ performanceMetrics, compareLabel }) => (
  <div
    className="group relative z-0 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md px-5 py-4 transition-all duration-500 hover:border-white/20 hover:bg-white/10 flex flex-col gap-4 lg:col-span-3"
    style={{ animation: 'fadeInUp 0.6s ease-out 0.6s backwards' }}
  >
    <div className="flex items-center flex-wrap gap-2 relative w-full">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
        <Activity className="w-4 h-4 text-cyan-400" />
        <span>{compareLabel}</span>
      </h3>
    </div>

    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {performanceMetrics.map((metric) => {
        const displayValue = Math.abs(metric.value).toFixed(0);
        const isPositive = Number(displayValue) === 0 || metric.value > 0;
        return (
          <div key={metric.label} className="flex flex-col gap-1 rounded-xl border border-white/5 bg-white/0 px-3 py-2">
            <span className="text-xs text-gray-500 uppercase tracking-wide">{metric.label}</span>
            <div className={`text-sm font-semibold flex items-center ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {isPositive ? <ArrowUp className="w-3 h-3 mr-1" /> : <ArrowDown className="w-3 h-3 mr-1" />}
              {displayValue}%
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

export default PerformanceCard;
