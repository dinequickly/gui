// ─── File kinds ────────────────────────────────────────────────────────────────
export type FileKind = 'page' | 'spreadsheet' | 'database';
export type DatabaseViewKind = 'table' | 'board' | 'calendar' | 'gallery' | 'list';

// ─── Workspace file (top-level record) ─────────────────────────────────────────
export interface WorkspaceFile {
  id: string;
  kind: FileKind;
  title: string;
  author: string;
  createdAt: number;
  updatedAt: number;
  coverImageUrl?: string;
  tags?: string[];
  // For database files, store the view kind here too for quick access
  viewKind?: DatabaseViewKind;
}

// ─── Blocks ────────────────────────────────────────────────────────────────────
export type BlockType =
  | 'title'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'paragraph'
  | 'todo'
  | 'bullet'
  | 'numbered'
  | 'toggle'
  | 'quote'
  | 'divider'
  | 'callout'
  | 'image'
  | 'database_embed';

export interface BaseBlock {
  id: string;
  type: BlockType;
}

export interface TextBlock extends BaseBlock {
  type: 'title' | 'heading1' | 'heading2' | 'heading3' | 'paragraph' | 'bullet' | 'numbered' | 'quote';
  text: string;
}

export interface TodoBlock extends BaseBlock {
  type: 'todo';
  text: string;
  checked: boolean;
}

export interface ToggleBlock extends BaseBlock {
  type: 'toggle';
  text: string;
  children: Block[];
  open: boolean;
}

export interface DividerBlock extends BaseBlock {
  type: 'divider';
}

export interface CalloutBlock extends BaseBlock {
  type: 'callout';
  text: string;
  icon: string;
  color: string;
}

export interface ImageBlock extends BaseBlock {
  type: 'image';
  url: string;
  caption?: string;
}

export interface DatabaseEmbedBlock extends BaseBlock {
  type: 'database_embed';
  databaseFileId: string;
}

export type Block =
  | TextBlock
  | TodoBlock
  | ToggleBlock
  | DividerBlock
  | CalloutBlock
  | ImageBlock
  | DatabaseEmbedBlock;

export interface PageCitation {
  id: string;
  source: string;
  title: string;
  url?: string;
}

// ─── Page document ─────────────────────────────────────────────────────────────
export interface PageDocument {
  id: string; // matches WorkspaceFile.id
  blocks: Block[];
  citations?: PageCitation[];
}

// ─── Spreadsheet ───────────────────────────────────────────────────────────────
export type ColumnType = 'text' | 'number' | 'date' | 'checkbox' | 'select';

export interface SpreadsheetColumn {
  id: string;
  name: string;
  type: ColumnType;
  options?: string[]; // for select
  width?: number;
}

export type CellValue = string | number | boolean | null;

export interface SpreadsheetRow {
  id: string;
  cells: Record<string, CellValue>; // columnId -> value
}

export interface SpreadsheetDocument {
  id: string;
  columns: SpreadsheetColumn[];
  rows: SpreadsheetRow[];
}

// ─── Database ──────────────────────────────────────────────────────────────────
export interface DatabaseField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'checkbox' | 'person' | 'url';
  options?: { id: string; label: string; color: string }[];
}

export interface DatabaseRecord {
  id: string;
  fields: Record<string, CellValue | string[]>; // fieldId -> value
}

export interface DatabaseDocument {
  id: string;
  viewKind: DatabaseViewKind;
  schema: DatabaseField[];
  records: DatabaseRecord[];
  // board: which field to group by
  groupByField?: string;
  // calendar: which field is the date
  dateField?: string;
}

// ─── Dashboard previews ────────────────────────────────────────────────────────
export interface PagePreview {
  kind: 'page';
  file: WorkspaceFile;
  snippet: string;
  imageUrl?: string;
}

export interface SpreadsheetPreview {
  kind: 'spreadsheet';
  file: WorkspaceFile;
  columns: SpreadsheetColumn[];
  rows: SpreadsheetRow[]; // max 5
}

export interface CalendarPreview {
  kind: 'calendar';
  file: WorkspaceFile;
  records: DatabaseRecord[];
  dateField: string;
  titleField: string;
  schema?: DatabaseField[];
}

export interface GenericDbPreview {
  kind: 'database';
  file: WorkspaceFile;
  viewKind: DatabaseViewKind;
  recordCount: number;
  records?: DatabaseRecord[];
  schema?: DatabaseField[];
  groupByField?: string;
}

export type DashboardPreview =
  | PagePreview
  | SpreadsheetPreview
  | CalendarPreview
  | GenericDbPreview;

// ─── App meta ──────────────────────────────────────────────────────────────────
export interface AppMeta {
  id: 'singleton';
  isSeeded: boolean;
}
