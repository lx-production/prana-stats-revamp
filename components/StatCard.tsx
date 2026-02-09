import React from 'react';
import { StatCardProps } from '../types';

const StatCard: React.FC<StatCardProps> = ({
  title,
  mainValue,
  subValue,
  icon: Icon,
  delay = 0,
  loading = false,
  highlight = false,
  className = '',
  footer,
}) => {
  return (
    <div
      className={`
        group relative z-10 hover:z-30 focus-within:z-40 rounded-2xl border transition-all duration-500
        ${highlight 
          ? 'border-cyan-500/30 bg-cyan-950/10 shadow-[0_0_30px_rgba(8,145,178,0.1)]' 
          : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
        }
        backdrop-blur-md
        ${className}
      `}
      style={{
        animation: `fadeInUp 0.6s ease-out ${delay}s backwards`
      }}
    >
      {/* Glow Effect */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <div className="absolute -inset-full top-0 block h-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-0 group-hover:animate-shine" />
      </div>
      
      <div className="p-5 flex flex-col h-full relative z-10">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
            {Icon && <Icon className="w-4 h-4 text-cyan-400" />}
            {title}
          </h3>
        </div>

        <div className="flex flex-col gap-1">
          {loading ? (
            <div className="h-8 w-32 bg-white/10 animate-pulse rounded" />
          ) : (
            <div className={`text-2xl sm:text-3xl font-bold tracking-tight ${highlight ? 'text-cyan-100' : 'text-white'}`}>
              {mainValue}
              <span className="text-sm font-normal text-gray-500 ml-2">
                {typeof mainValue === 'string' && mainValue.includes('VNĐ') ? '' : ''}
              </span>
            </div>
          )}
          
          {subValue && (
            <div className="text-sm text-gray-400 font-mono mt-0.5">
              {loading ? <div className="h-4 w-24 bg-white/10 animate-pulse rounded" /> : subValue}
            </div>
          )}
        </div>

        {footer && (
          <div className="mt-auto pt-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
