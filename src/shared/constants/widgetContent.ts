export const CALENDAR_DB_ID = 'seed-calendar';
export const WIDGET_PAGES_DB_ID = 'seed-widget-pages';
export const WIDGET_REMINDERS_DB_ID = 'seed-widget-reminders';
export const WIDGET_TODOS_DB_ID = 'seed-widget-todos';

export const ALLOWED_DATABASE_IDS = [
  CALENDAR_DB_ID,
  WIDGET_PAGES_DB_ID,
  WIDGET_REMINDERS_DB_ID,
  WIDGET_TODOS_DB_ID,
] as const;

export function widgetPageFileId(recordId: string) {
  return `widget-page-${recordId}`;
}

export function isWidgetPageFileId(fileId: string) {
  return fileId.startsWith('widget-page-');
}
