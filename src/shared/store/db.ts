import Dexie, { type Table } from 'dexie';
import type {
  WorkspaceFile,
  PageDocument,
  SpreadsheetDocument,
  DatabaseDocument,
  AppMeta,
} from '../types';

export class NotionDB extends Dexie {
  files!: Table<WorkspaceFile, string>;
  pages!: Table<PageDocument, string>;
  spreadsheets!: Table<SpreadsheetDocument, string>;
  databases!: Table<DatabaseDocument, string>;
  meta!: Table<AppMeta, string>;

  constructor() {
    super('NotionApp');
    this.version(1).stores({
      files: 'id, kind, title, author, createdAt, updatedAt',
      pages: 'id',
      spreadsheets: 'id',
      databases: 'id',
      meta: 'id',
    });
    // v2: drop unused widget tables (data now lives in databases table)
    this.version(2).stores({
      files: 'id, kind, title, author, createdAt, updatedAt',
      pages: 'id',
      spreadsheets: 'id',
      databases: 'id',
      meta: 'id',
      widgetPages: null,
      widgetNotifications: null,
      widgetReminders: null,
    });
  }
}

export const db = new NotionDB();
