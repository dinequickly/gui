import { create } from 'zustand';
import { db } from './db';
import type {
  WorkspaceFile,
  DatabaseViewKind,
  PageDocument,
  SpreadsheetDocument,
  DatabaseDocument,
  Block,
} from '../types';
import { nanoid } from '../utils/nanoid';

// ─── Helper ────────────────────────────────────────────────────────────────────
function now() {
  return Date.now();
}

// ─── Store types ───────────────────────────────────────────────────────────────
interface FileStore {
  files: WorkspaceFile[];
  loaded: boolean;
  loadFiles: () => Promise<void>;
  createPage: (title?: string, author?: string) => Promise<string>;
  createSpreadsheet: (title?: string, author?: string) => Promise<string>;
  createDatabase: (viewKind: DatabaseViewKind, title?: string, author?: string) => Promise<string>;
  updateFile: (id: string, patch: Partial<WorkspaceFile>) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  seedIfEmpty: () => Promise<void>;
}

export const useFileStore = create<FileStore>((set, get) => ({
  files: [],
  loaded: false,

  loadFiles: async () => {
    const files = await db.files.orderBy('updatedAt').reverse().toArray();
    set({ files, loaded: true });
  },

  createPage: async (title = 'Untitled', author = 'You') => {
    const id = nanoid();
    const ts = now();
    const file: WorkspaceFile = { id, kind: 'page', title, author, createdAt: ts, updatedAt: ts };
    const page: PageDocument = { id, blocks: [] };
    await db.files.add(file);
    await db.pages.add(page);
    await get().loadFiles();
    return id;
  },

  createSpreadsheet: async (title = 'Untitled', author = 'You') => {
    const id = nanoid();
    const ts = now();
    const file: WorkspaceFile = { id, kind: 'spreadsheet', title, author, createdAt: ts, updatedAt: ts };
    const sheet: SpreadsheetDocument = { id, columns: [], rows: [] };
    await db.files.add(file);
    await db.spreadsheets.add(sheet);
    await get().loadFiles();
    return id;
  },

  createDatabase: async (viewKind, title = 'Untitled', author = 'You') => {
    const id = nanoid();
    const ts = now();
    const file: WorkspaceFile = { id, kind: 'database', title, author, createdAt: ts, updatedAt: ts, viewKind };
    const dbDoc: DatabaseDocument = { id, viewKind, schema: [], records: [] };
    await db.files.add(file);
    await db.databases.add(dbDoc);
    await get().loadFiles();
    return id;
  },

  updateFile: async (id, patch) => {
    await db.files.update(id, { ...patch, updatedAt: now() });
    await get().loadFiles();
  },

  deleteFile: async (id) => {
    const file = await db.files.get(id);
    if (!file) return;
    await db.files.delete(id);
    if (file.kind === 'page') await db.pages.delete(id);
    if (file.kind === 'spreadsheet') await db.spreadsheets.delete(id);
    if (file.kind === 'database') await db.databases.delete(id);
    await get().loadFiles();
  },

  seedIfEmpty: async () => {
    const meta = await db.meta.get('singleton');
    if (!meta?.isSeeded) {
      const { seedData } = await import('../utils/seed');
      await seedData();
      await db.meta.put({ id: 'singleton', isSeeded: true });
    }
    const { enforceWidgetCalendarOnlyContent } = await import('../utils/seed');
    await enforceWidgetCalendarOnlyContent();
    await get().loadFiles();
  },
}));

// ─── Page document helpers ─────────────────────────────────────────────────────
export async function getPage(id: string): Promise<PageDocument | undefined> {
  return db.pages.get(id);
}

export async function updatePage(id: string, blocks: Block[]): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db.pages as any).update(id, { blocks });
  await db.files.update(id, { updatedAt: now() });
}

// ─── Spreadsheet helpers ───────────────────────────────────────────────────────
export async function getSpreadsheet(id: string): Promise<SpreadsheetDocument | undefined> {
  return db.spreadsheets.get(id);
}

export async function updateSpreadsheet(id: string, data: Partial<SpreadsheetDocument>): Promise<void> {
  await db.spreadsheets.update(id, data);
  await db.files.update(id, { updatedAt: now() });
}

// ─── Database helpers ──────────────────────────────────────────────────────────
export async function getDatabase(id: string): Promise<DatabaseDocument | undefined> {
  return db.databases.get(id);
}

export async function updateDatabase(id: string, data: Partial<DatabaseDocument>): Promise<void> {
  await db.databases.update(id, data);
  await db.files.update(id, { updatedAt: now() });
}
