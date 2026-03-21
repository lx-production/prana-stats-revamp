export interface TimelineEvent {
  id: string;
  timestamp: number;
  title: string;
  description: string;
  color: string;
  icon: string;
  link?: string;
}

/** Shared fields for each timeline card; text lives in locale copy maps. */
export interface TimelineEventMeta {
  id: string;
  timestamp: number;
  color: string;
  icon: string;
  link?: string;
}

export interface TimelineEventCopy {
  title: string;
  description: string;
}
