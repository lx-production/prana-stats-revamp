import { useMemo } from "react";
import { TIMELINE_COPY_EN, TIMELINE_COPY_VI } from "../data/timelineCopy";
import { TIMELINE_EVENTS_META } from "../data/timelineEventsMeta";
import { useSiteLanguage } from "./useSiteLanguage";
import type { TimelineEvent } from "../types/timeline.ts";

export const useTimelineEvents = (): TimelineEvent[] => {
  const { locale } = useSiteLanguage();
  return useMemo(() => {
    const copy = locale === "en" ? TIMELINE_COPY_EN : TIMELINE_COPY_VI;
    return TIMELINE_EVENTS_META.map((meta) => {
      const text = copy[meta.id];
      return {
        ...meta,
        title: text.title,
        description: text.description,
      };
    });
  }, [locale]);
};
