export interface TimelineEvent {
  id: string;
  timestamp: number;
  title: string;
  description: string;
  color: string;
  icon: string;
  link?: string;
}
