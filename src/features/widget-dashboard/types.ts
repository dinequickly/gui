export type WidgetColumn = 1 | 2 | 3 | 4;

export interface WidgetLayoutItem {
  id: string;
  type: string;
  column: WidgetColumn;
  order: number;
  width: number;
  height: number;
  props: Record<string, unknown>;
  group?: string;
}

export interface DashboardLayout {
  widgets: WidgetLayoutItem[];
}

export interface WidgetComponentProps {
  item: WidgetLayoutItem;
}
