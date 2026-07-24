import type { TimelineEventMeta } from "../types/timeline";

export const TIMELINE_EVENTS_META = [
  {
    id: "event_1",
    timestamp: 1628996429,
    color: "#160af5",
    icon: "1",
    link: "https://drive.google.com/file/d/1DfMpOknKZRXlITFG0L9RFjHstDzyFNtS/view?usp=sharing",
  },
  {
    id: "event_2",
    timestamp: 1662539947,
    color: "#ef4444",
    icon: "2",
  },
  {
    id: "event_3",
    timestamp: 1663149191,
    color: "#49f54c",
    icon: "3",
  },
  {
    id: "event_4",
    timestamp: 1713688933,
    color: "#1888ff",
    icon: "4",
  },
  {
    id: "event_5",
    timestamp: 1739927178,
    color: "#5d2ce6",
    icon: "5",
    link: "https://drive.google.com/file/d/1Ob0SDFTHoeiUrKrsrBugi7j34yOYA17j/view?usp=sharing",
  },
  {
    id: "event_6",
    timestamp: 1742006710,
    color: "#FF1493",
    icon: "6",
  },
  {
    id: "event_7",
    timestamp: 1744423130,
    color: "#FF1493",
    icon: "7",
  },
  {
    id: "event_8",
    timestamp: 1748044800,
    color: "#f59e0b",
    icon: "8",
  },
  {
    id: "event_9",
    timestamp: 1757721600,
    color: "#0ea5e9",
    icon: "9",
    link: "https://akasha.triethocduongpho.net/",
  },
  {
    id: "event_10",
    timestamp: 1760745600,
    color: "#a855f7",
    icon: "10",
    link: "https://akasha.triethocduongpho.net/",
  },
  {
    id: "event_11",
    timestamp: 1761955200,
    color: "#14b8a6",
    icon: "11",
  },
  {
    id: "event_12",
    timestamp: 1773100800,
    color: "#22c55e",
    icon: "12",
  },
  {
    id: "event_13",
    timestamp: 1778025600,
    color: "#f97316",
    icon: "13",
  },
  {
    id: "event_14",
    timestamp: 1784505600,
    color: "#e879f9",
    icon: "14",
  },
  {
    id: "event_15",
    timestamp: 1784851200,
    color: "#6366f1",
    icon: "15",
  },
] as const satisfies readonly TimelineEventMeta[];

export type TimelineEventId = (typeof TIMELINE_EVENTS_META)[number]["id"];
