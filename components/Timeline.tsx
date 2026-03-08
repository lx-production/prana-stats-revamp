import React from "react";
import { Clock, ExternalLink } from "lucide-react";
import { useTimelineEvents } from "../hooks/useTimelineEvents";

const Timeline: React.FC = () => {
  const events = useTimelineEvents();

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-5">
          <Clock className="h-5 w-5 text-cyan-300" />
          <h2 className="text-lg sm:text-xl font-semibold tracking-wide text-white">
            Lịch Sử PRANA
          </h2>
        </div>

        <div className="relative overflow-x-auto pt-4 pb-4 -mx-2 px-2">
          <div className="flex gap-4 min-w-max pb-2">
            {events.map((event, index) => (
              <div
                key={event.id}
                className="relative flex-shrink-0 w-[320px] sm:w-[360px]"
                style={{
                  animation: `fadeInUp 0.6s ease-out ${index * 0.1}s backwards`,
                }}
              >
                <div className="group relative rounded-xl border border-white/10 bg-[#0b0c27]/70 hover:border-white/20 transition-all duration-300 h-full">
                  <div className="absolute top-0 left-4 flex -translate-y-1/2 items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold shadow-lg"
                      style={{
                        backgroundColor: event.color,
                        boxShadow: `0 0 20px ${event.color}40`,
                      }}
                    >
                      {event.icon}
                    </div>
                    <div className="text-xs text-gray-400 bg-[#0b0c27]/90 px-2 py-1 rounded-md border border-white/5">
                      {formatDate(event.timestamp)}
                    </div>
                  </div>

                  <div className="p-4 pt-10">
                    <h3 className="text-base sm:text-lg font-semibold text-white mb-2 flex items-center justify-between gap-2">
                      {event.title}
                      {event.link && (
                        <a
                          href={event.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-400 hover:text-cyan-300 transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {event.description}
                    </p>
                  </div>

                  <div
                    className="absolute bottom-0 left-0 h-1 w-full rounded-b-xl"
                    style={{
                      background: `linear-gradient(90deg, ${event.color}00 0%, ${event.color} 50%, ${event.color}00 100%)`,
                    }}
                  />
                </div>

                {index < events.length - 1 && (
                  <div className="absolute top-6 -right-[18px] w-[18px] h-[2px] bg-gradient-to-r from-white/20 to-transparent z-0" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-2 text-xs text-gray-500 text-center">
          Cuộn ngang để xem thêm →
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .overflow-x-auto::-webkit-scrollbar {
          height: 8px;
        }
        
        .overflow-x-auto::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }
        
        .overflow-x-auto::-webkit-scrollbar-thumb {
          background: rgba(6, 182, 212, 0.3);
          border-radius: 4px;
        }
        
        .overflow-x-auto::-webkit-scrollbar-thumb:hover {
          background: rgba(6, 182, 212, 0.5);
        }
      `}</style>
    </section>
  );
};

export default Timeline;
