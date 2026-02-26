import { create } from 'zustand';
import { supabase } from './supabase';
import { nanoid } from '../utils/nanoid';
import type {
  WorkspaceFile,
  DatabaseViewKind,
  PageDocument,
  SpreadsheetDocument,
  DatabaseDocument,
  Block,
  DatabaseField,
  DatabaseRecord,
} from '../types';
import {
  CALENDAR_DB_ID,
  WIDGET_MEDIA_DB_ID,
  WIDGET_PAGES_DB_ID,
  WIDGET_REMINDERS_DB_ID,
  WIDGET_TODOS_DB_ID,
  widgetPageFileId,
} from '../constants/widgetContent';

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type UserFileRow = {
  user_id: string;
  id: string;
  kind: WorkspaceFile['kind'];
  title: string;
  author: string;
  created_at_ms: number;
  updated_at_ms: number;
  cover_image_url: string | null;
  tags: Json;
  view_kind: DatabaseViewKind | null;
};

type UserPageRow = {
  user_id: string;
  id: string;
  blocks: Json;
  citations: Json;
};

type UserSpreadsheetRow = {
  user_id: string;
  id: string;
  columns: Json;
  rows: Json;
};

type UserDatabaseRow = {
  user_id: string;
  id: string;
  view_kind: DatabaseViewKind;
  schema: Json;
  records: Json;
  group_by_field: string | null;
  date_field: string | null;
};

function now() {
  return Date.now();
}

function asArray<T>(value: unknown, fallback: T[] = []): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

function requireUserId() {
  return supabase.auth.getUser().then(({ data, error }) => {
    if (error) throw error;
    const userId = data.user?.id;
    if (!userId) throw new Error('Not authenticated');
    return userId;
  });
}

function toWorkspaceFile(row: UserFileRow): WorkspaceFile {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    author: row.author,
    createdAt: row.created_at_ms,
    updatedAt: row.updated_at_ms,
    coverImageUrl: row.cover_image_url ?? undefined,
    tags: asArray<string>(row.tags, []),
    viewKind: row.view_kind ?? undefined,
  };
}

function toPageDocument(row: UserPageRow): PageDocument {
  return {
    id: row.id,
    blocks: asArray<Block>(row.blocks, []),
    citations: asArray(row.citations, []),
  };
}

function toSpreadsheetDocument(row: UserSpreadsheetRow): SpreadsheetDocument {
  return {
    id: row.id,
    columns: asArray(row.columns, []),
    rows: asArray(row.rows, []),
  };
}

function toDatabaseDocument(row: UserDatabaseRow): DatabaseDocument {
  return {
    id: row.id,
    viewKind: row.view_kind,
    schema: asArray<DatabaseField>(row.schema, []),
    records: asArray<DatabaseRecord>(row.records, []),
    groupByField: row.group_by_field ?? undefined,
    dateField: row.date_field ?? undefined,
  };
}

async function upsertFile(userId: string, file: WorkspaceFile) {
  const { error } = await supabase.from('user_files').upsert({
    user_id: userId,
    id: file.id,
    kind: file.kind,
    title: file.title,
    author: file.author,
    created_at_ms: file.createdAt,
    updated_at_ms: file.updatedAt,
    cover_image_url: file.coverImageUrl ?? null,
    tags: file.tags ?? [],
    view_kind: file.viewKind ?? null,
  }, { onConflict: 'user_id,id' });
  if (error) throw error;
}

const PROJECT_FIELDS: DatabaseField[] = [
  { id: 'f1', name: 'Name', type: 'text', options: [] },
  {
    id: 'f2',
    name: 'Status',
    type: 'select',
    options: [
      { id: 's1', label: 'Not started', color: '#e2e8f0' },
      { id: 's2', label: 'In progress', color: '#bfdbfe' },
      { id: 's3', label: 'Done', color: '#bbf7d0' },
    ],
  },
  {
    id: 'f3',
    name: 'Priority',
    type: 'select',
    options: [
      { id: 'p1', label: 'Low', color: '#fef9c3' },
      { id: 'p2', label: 'Medium', color: '#fed7aa' },
      { id: 'p3', label: 'High', color: '#fecaca' },
    ],
  },
  { id: 'f4', name: 'Due date', type: 'date', options: [] },
  { id: 'f5', name: 'Assignee', type: 'person', options: [] },
];

const PROJECT_RECORDS: DatabaseRecord[] = [
  { id: 'r1', fields: { f1: 'Finalize edge-runtime migration guide', f2: 'In progress', f3: 'High', f4: '2026-03-02', f5: 'Maya' } },
  { id: 'r2', fields: { f1: 'Publish RAG eval benchmark write-up', f2: 'Not started', f3: 'Medium', f4: '2026-03-06', f5: 'Noah' } },
  { id: 'r3', fields: { f1: 'Patch OAuth callback race condition', f2: 'Done', f3: 'High', f4: '2026-02-24', f5: 'Ari' } },
];

const WIDGET_PAGE_FIELDS: DatabaseField[] = [
  { id: 'wp-f1', name: 'Title', type: 'text', options: [] },
  { id: 'wp-f2', name: 'Subtitle', type: 'text', options: [] },
  { id: 'wp-f3', name: 'Body', type: 'text', options: [] },
  { id: 'wp-f4', name: 'Author', type: 'text', options: [] },
  { id: 'wp-f5', name: 'Link', type: 'url', options: [] },
  {
    id: 'wp-f6',
    name: 'Size',
    type: 'select',
    options: [
      { id: 'wps1', label: 'small', color: '#bfdbfe' },
      { id: 'wps2', label: 'large', color: '#e9d5ff' },
    ],
  },
];

const WIDGET_PAGE_RECORDS: DatabaseRecord[] = [
  {
    id: 'wpr1',
    fields: {
      'wp-f1': 'The Day We Replaced Standup with a Lighthouse',
      'wp-f2': 'Field Notes from Team Orbit',
      'wp-f3': 'A short systems note on better team navigation.',
      'wp-f4': 'Maxwell Moroz',
      'wp-f5': 'https://example.com/lighthouse-standup',
      'wp-f6': 'small',
    },
  },
  {
    id: 'wpr2',
    fields: {
      'wp-f1': 'How to Train a Product Roadmap Like a Bonsai Tree',
      'wp-f2': 'Saturday Systems Essay',
      'wp-f3': 'Prune scope, shape intent, and keep shipping velocity healthy.',
      'wp-f4': 'Maxwell Moroz',
      'wp-f5': 'https://example.com/roadmap-bonsai',
      'wp-f6': 'large',
    },
  },
];

const WIDGET_REMINDER_FIELDS: DatabaseField[] = [
  { id: 'wr-f1', name: 'Label', type: 'text', options: [] },
  {
    id: 'wr-f2',
    name: 'Icon',
    type: 'select',
    options: [
      { id: 'wri1', label: 'block', color: '#bfdbfe' },
      { id: 'wri2', label: 'timer', color: '#bbf7d0' },
      { id: 'wri3', label: 'gif', color: '#fed7aa' },
      { id: 'wri4', label: 'note', color: '#e9d5ff' },
    ],
  },
];

const WIDGET_REMINDER_RECORDS: DatabaseRecord[] = [
  { id: 'wrr1', fields: { 'wr-f1': 'Deep work: architecture pass (90m)', 'wr-f2': 'block' } },
  { id: 'wrr2', fields: { 'wr-f1': 'Stand up and reset focus', 'wr-f2': 'timer' } },
  { id: 'wrr3', fields: { 'wr-f1': 'Capture 20s product demo clip', 'wr-f2': 'gif' } },
  { id: 'wrr4', fields: { 'wr-f1': 'Write follow-up note with date', 'wr-f2': 'note' } },
];

const WIDGET_TODO_FIELDS: DatabaseField[] = [
  { id: 'wt-f1', name: 'Title', type: 'text', options: [] },
  { id: 'wt-f2', name: 'Assignee', type: 'person', options: [] },
  { id: 'wt-f3', name: 'Date', type: 'date', options: [] },
];

const WIDGET_TODO_RECORDS: DatabaseRecord[] = [
  { id: 'wtr1', fields: { 'wt-f1': 'Ship semantic caching to staging', 'wt-f2': 'Ari', 'wt-f3': '2026-03-01' } },
  { id: 'wtr2', fields: { 'wt-f1': 'Tune eval set for retrieval drift', 'wt-f2': 'Noah', 'wt-f3': '2026-03-03' } },
  { id: 'wtr3', fields: { 'wt-f1': 'Fix mobile nav hydration mismatch', 'wt-f2': 'Lena', 'wt-f3': '2026-03-04' } },
];

const WIDGET_MEDIA_FIELDS: DatabaseField[] = [
  { id: 'wm-f1', name: 'Title', type: 'text', options: [] },
  { id: 'wm-f2', name: 'Subtitle', type: 'text', options: [] },
  { id: 'wm-f3', name: 'Embed URL', type: 'url', options: [] },
];

const WIDGET_MEDIA_RECORDS: DatabaseRecord[] = [
  {
    id: 'wmr1',
    fields: {
      'wm-f1': 'House Mix',
      'wm-f2': 'by yakatori',
      'wm-f3': 'https://www.youtube.com/embed/knsHR4Z_LcM?si=aWzVZ641wvGYJinL',
    },
  },
];

async function ensureSeededWorkspace(userId: string) {
  const { data: meta, error: metaErr } = await supabase
    .from('user_app_meta')
    .select('is_seeded')
    .eq('user_id', userId)
    .maybeSingle();
  if (metaErr) throw metaErr;
  if (meta?.is_seeded) return;

  const ts = now();
  const fileRows: WorkspaceFile[] = [
    { id: CALENDAR_DB_ID, kind: 'database', title: 'Calendar', author: 'System', createdAt: ts, updatedAt: ts, viewKind: 'calendar', tags: ['calendar'] },
    { id: WIDGET_PAGES_DB_ID, kind: 'database', title: 'Widget Pages', author: 'System', createdAt: ts, updatedAt: ts, viewKind: 'table', tags: ['widgets'] },
    { id: WIDGET_REMINDERS_DB_ID, kind: 'database', title: 'Widget Reminders', author: 'System', createdAt: ts, updatedAt: ts, viewKind: 'table', tags: ['widgets'] },
    { id: WIDGET_TODOS_DB_ID, kind: 'database', title: 'Widget Todos', author: 'System', createdAt: ts, updatedAt: ts, viewKind: 'table', tags: ['widgets'] },
    { id: WIDGET_MEDIA_DB_ID, kind: 'database', title: 'Widget Media', author: 'System', createdAt: ts, updatedAt: ts, viewKind: 'table', tags: ['widgets'] },
  ];

  for (const file of fileRows) {
    await upsertFile(userId, file);
  }

  const dbRows = [
    { id: CALENDAR_DB_ID, view_kind: 'calendar' as DatabaseViewKind, schema: PROJECT_FIELDS, records: PROJECT_RECORDS, group_by_field: 'f2', date_field: 'f4' },
    { id: WIDGET_PAGES_DB_ID, view_kind: 'table' as DatabaseViewKind, schema: WIDGET_PAGE_FIELDS, records: WIDGET_PAGE_RECORDS, group_by_field: null, date_field: null },
    { id: WIDGET_REMINDERS_DB_ID, view_kind: 'table' as DatabaseViewKind, schema: WIDGET_REMINDER_FIELDS, records: WIDGET_REMINDER_RECORDS, group_by_field: null, date_field: null },
    { id: WIDGET_TODOS_DB_ID, view_kind: 'table' as DatabaseViewKind, schema: WIDGET_TODO_FIELDS, records: WIDGET_TODO_RECORDS, group_by_field: null, date_field: null },
    { id: WIDGET_MEDIA_DB_ID, view_kind: 'table' as DatabaseViewKind, schema: WIDGET_MEDIA_FIELDS, records: WIDGET_MEDIA_RECORDS, group_by_field: null, date_field: null },
  ];

  const { error: dbError } = await supabase
    .from('user_databases')
    .upsert(dbRows.map((row) => ({ user_id: userId, ...row })), { onConflict: 'user_id,id' });
  if (dbError) throw dbError;

  const { error: metaUpsertError } = await supabase
    .from('user_app_meta')
    .upsert({ user_id: userId, is_seeded: true }, { onConflict: 'user_id' });
  if (metaUpsertError) throw metaUpsertError;
}

async function ensureWidgetPageFilesExist(userId: string) {
  const { data: widgetDbRow, error: widgetDbError } = await supabase
    .from('user_databases')
    .select('schema,records')
    .eq('user_id', userId)
    .eq('id', WIDGET_PAGES_DB_ID)
    .maybeSingle();
  if (widgetDbError) throw widgetDbError;
  if (!widgetDbRow) return;

  const schema = asArray<DatabaseField>(widgetDbRow.schema, []);
  const records = asArray<DatabaseRecord>(widgetDbRow.records, []);
  const fieldByName = Object.fromEntries(schema.map((field) => [field.name, field.id]));
  const titleFieldId = fieldByName.Title;
  const subtitleFieldId = fieldByName.Subtitle;
  const bodyFieldId = fieldByName.Body;
  const authorFieldId = fieldByName.Author;

  if (!titleFieldId) return;

  const desiredPageFiles = records.map((record) => {
    const fileId = widgetPageFileId(record.id);
    const title = String(record.fields[titleFieldId] ?? 'Untitled').trim() || 'Untitled';
    const subtitle = subtitleFieldId ? String(record.fields[subtitleFieldId] ?? '').trim() : '';
    const body = bodyFieldId ? String(record.fields[bodyFieldId] ?? '').trim() : '';
    const author = authorFieldId ? String(record.fields[authorFieldId] ?? 'System').trim() || 'System' : 'System';
    return {
      file: {
        user_id: userId,
        id: fileId,
        kind: 'page' as const,
        title,
        author,
        created_at_ms: now(),
        updated_at_ms: now(),
        cover_image_url: null,
        tags: ['widget-page'],
        view_kind: null,
      },
      page: {
        user_id: userId,
        id: fileId,
        blocks: [
          ...(subtitle ? [{ id: `${fileId}-subtitle`, type: 'paragraph', text: subtitle }] : []),
          ...(body ? [{ id: `${fileId}-body`, type: 'paragraph', text: body }] : []),
        ],
        citations: [],
      },
    };
  });

  if (desiredPageFiles.length === 0) return;

  const desiredIds = desiredPageFiles.map((entry) => entry.file.id);
  const { data: existingFiles, error: existingError } = await supabase
    .from('user_files')
    .select('id')
    .eq('user_id', userId)
    .in('id', desiredIds);
  if (existingError) throw existingError;
  const existingIds = new Set((existingFiles ?? []).map((row) => String(row.id)));
  const missing = desiredPageFiles.filter((entry) => !existingIds.has(entry.file.id));
  if (missing.length === 0) return;

  const { error: fileUpsertError } = await supabase
    .from('user_files')
    .upsert(missing.map((entry) => entry.file), { onConflict: 'user_id,id' });
  if (fileUpsertError) throw fileUpsertError;

  const { error: pageUpsertError } = await supabase
    .from('user_pages')
    .upsert(missing.map((entry) => entry.page), { onConflict: 'user_id,id' });
  if (pageUpsertError) throw pageUpsertError;
}

async function migrateLegacyIndexedDbToSupabase(userId: string) {
  const { db } = await import('./db');

  const localFiles = await db.files.toArray();
  if (localFiles.length === 0) return;

  const localPages = await db.pages.toArray();
  const localSheets = await db.spreadsheets.toArray();
  const localDatabases = await db.databases.toArray();
  const localMeta = await db.meta.get('singleton');

  const { error: filesError } = await supabase
    .from('user_files')
    .upsert(localFiles.map((file) => ({
      user_id: userId,
      id: file.id,
      kind: file.kind,
      title: file.title,
      author: file.author,
      created_at_ms: file.createdAt,
      updated_at_ms: file.updatedAt,
      cover_image_url: file.coverImageUrl ?? null,
      tags: file.tags ?? [],
      view_kind: file.viewKind ?? null,
    })), { onConflict: 'user_id,id' });
  if (filesError) throw filesError;

  if (localPages.length > 0) {
    const { error: pagesError } = await supabase
      .from('user_pages')
      .upsert(localPages.map((page) => ({
        user_id: userId,
        id: page.id,
        blocks: page.blocks ?? [],
        citations: page.citations ?? [],
      })), { onConflict: 'user_id,id' });
    if (pagesError) throw pagesError;
  }

  if (localSheets.length > 0) {
    const { error: sheetsError } = await supabase
      .from('user_spreadsheets')
      .upsert(localSheets.map((sheet) => ({
        user_id: userId,
        id: sheet.id,
        columns: sheet.columns ?? [],
        rows: sheet.rows ?? [],
      })), { onConflict: 'user_id,id' });
    if (sheetsError) throw sheetsError;
  }

  if (localDatabases.length > 0) {
    const { error: dbsError } = await supabase
      .from('user_databases')
      .upsert(localDatabases.map((database) => ({
        user_id: userId,
        id: database.id,
        view_kind: database.viewKind,
        schema: database.schema ?? [],
        records: database.records ?? [],
        group_by_field: database.groupByField ?? null,
        date_field: database.dateField ?? null,
      })), { onConflict: 'user_id,id' });
    if (dbsError) throw dbsError;
  }

  const { error: metaError } = await supabase
    .from('user_app_meta')
    .upsert({
      user_id: userId,
      is_seeded: localMeta?.isSeeded ?? false,
    }, { onConflict: 'user_id' });
  if (metaError) throw metaError;

  await Promise.all([
    db.files.clear(),
    db.pages.clear(),
    db.spreadsheets.clear(),
    db.databases.clear(),
    db.meta.clear(),
  ]);
}

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
    try {
      const userId = await requireUserId();
      const { data, error } = await supabase
        .from('user_files')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at_ms', { ascending: false });
      if (error) throw error;
      set({ files: (data ?? []).map((row) => toWorkspaceFile(row as UserFileRow)), loaded: true });
    } catch (error) {
      console.error('[fileStore] Failed to load files from Supabase:', error);
      set({ files: [], loaded: true });
    }
  },

  createPage: async (title = 'Untitled', author = 'You') => {
    const userId = await requireUserId();
    const id = nanoid();
    const ts = now();
    await upsertFile(userId, { id, kind: 'page', title, author, createdAt: ts, updatedAt: ts });
    const { error: pageError } = await supabase
      .from('user_pages')
      .upsert({ user_id: userId, id, blocks: [], citations: [] }, { onConflict: 'user_id,id' });
    if (pageError) throw pageError;
    await get().loadFiles();
    return id;
  },

  createSpreadsheet: async (title = 'Untitled', author = 'You') => {
    const userId = await requireUserId();
    const id = nanoid();
    const ts = now();
    await upsertFile(userId, { id, kind: 'spreadsheet', title, author, createdAt: ts, updatedAt: ts });
    const { error: sheetError } = await supabase
      .from('user_spreadsheets')
      .upsert({ user_id: userId, id, columns: [], rows: [] }, { onConflict: 'user_id,id' });
    if (sheetError) throw sheetError;
    await get().loadFiles();
    return id;
  },

  createDatabase: async (viewKind, title = 'Untitled', author = 'You') => {
    const userId = await requireUserId();
    const id = nanoid();
    const ts = now();
    await upsertFile(userId, { id, kind: 'database', title, author, createdAt: ts, updatedAt: ts, viewKind });
    const { error: dbError } = await supabase
      .from('user_databases')
      .upsert({ user_id: userId, id, view_kind: viewKind, schema: [], records: [], group_by_field: null, date_field: null }, { onConflict: 'user_id,id' });
    if (dbError) throw dbError;
    await get().loadFiles();
    return id;
  },

  updateFile: async (id, patch) => {
    const userId = await requireUserId();
    const existing = await getFileById(id);
    if (!existing) return;
    const next: WorkspaceFile = {
      ...existing,
      ...patch,
      updatedAt: now(),
    };
    await upsertFile(userId, next);
    await get().loadFiles();
  },

  deleteFile: async (id) => {
    const userId = await requireUserId();
    const { error } = await supabase
      .from('user_files')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);
    if (error) throw error;
    await get().loadFiles();
  },

  seedIfEmpty: async () => {
    const userId = await requireUserId();
    await migrateLegacyIndexedDbToSupabase(userId);
    await ensureSeededWorkspace(userId);
    await ensureWidgetPageFilesExist(userId);
  },
}));

export async function getFileById(id: string): Promise<WorkspaceFile | undefined> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('user_files')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? toWorkspaceFile(data as UserFileRow) : undefined;
}

export async function getPage(id: string): Promise<PageDocument | undefined> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('user_pages')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? toPageDocument(data as UserPageRow) : undefined;
}

export async function updatePage(id: string, blocks: Block[]): Promise<void> {
  await updatePageDocument(id, { blocks });
}

export async function updatePageDocument(id: string, patch: Partial<PageDocument>): Promise<void> {
  const userId = await requireUserId();
  const current = await getPage(id);
  const next: PageDocument = {
    id,
    blocks: patch.blocks ?? current?.blocks ?? [],
    citations: patch.citations ?? current?.citations ?? [],
  };

  const { error: pageError } = await supabase
    .from('user_pages')
    .upsert({
      user_id: userId,
      id,
      blocks: next.blocks,
      citations: next.citations ?? [],
    }, { onConflict: 'user_id,id' });
  if (pageError) throw pageError;

  const existingFile = await getFileById(id);
  if (existingFile) {
    await upsertFile(userId, { ...existingFile, updatedAt: now() });
  }
}

export async function getSpreadsheet(id: string): Promise<SpreadsheetDocument | undefined> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('user_spreadsheets')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? toSpreadsheetDocument(data as UserSpreadsheetRow) : undefined;
}

export async function updateSpreadsheet(id: string, data: Partial<SpreadsheetDocument>): Promise<void> {
  const userId = await requireUserId();
  const current = await getSpreadsheet(id);
  if (!current) return;
  const next: SpreadsheetDocument = {
    id,
    columns: data.columns ?? current.columns,
    rows: data.rows ?? current.rows,
  };

  const { error: sheetError } = await supabase
    .from('user_spreadsheets')
    .upsert({
      user_id: userId,
      id,
      columns: next.columns,
      rows: next.rows,
    }, { onConflict: 'user_id,id' });
  if (sheetError) throw sheetError;

  const existingFile = await getFileById(id);
  if (existingFile) {
    await upsertFile(userId, { ...existingFile, updatedAt: now() });
  }
}

export async function getDatabase(id: string): Promise<DatabaseDocument | undefined> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('user_databases')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? toDatabaseDocument(data as UserDatabaseRow) : undefined;
}

export async function updateDatabase(id: string, data: Partial<DatabaseDocument>): Promise<void> {
  const userId = await requireUserId();
  const current = await getDatabase(id);
  if (!current) return;
  const next: DatabaseDocument = {
    id,
    viewKind: data.viewKind ?? current.viewKind,
    schema: data.schema ?? current.schema,
    records: data.records ?? current.records,
    groupByField: data.groupByField ?? current.groupByField,
    dateField: data.dateField ?? current.dateField,
  };

  const { error: dbError } = await supabase
    .from('user_databases')
    .upsert({
      user_id: userId,
      id,
      view_kind: next.viewKind,
      schema: next.schema,
      records: next.records,
      group_by_field: next.groupByField ?? null,
      date_field: next.dateField ?? null,
    }, { onConflict: 'user_id,id' });
  if (dbError) throw dbError;

  const existingFile = await getFileById(id);
  if (existingFile) {
    await upsertFile(userId, { ...existingFile, updatedAt: now(), viewKind: next.viewKind });
  }
}
