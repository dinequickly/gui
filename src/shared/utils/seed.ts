import { db } from '../store/db';
import type {
  WorkspaceFile,
  PageDocument,
  SpreadsheetDocument,
  DatabaseDocument,
  DatabaseField,
  DatabaseRecord,
} from '../types';
import {
  ALLOWED_DATABASE_IDS,
  CALENDAR_DB_ID,
  WIDGET_MEDIA_DB_ID,
  WIDGET_PAGES_DB_ID,
  WIDGET_REMINDERS_DB_ID,
  WIDGET_TODOS_DB_ID,
  widgetPageFileId,
  isWidgetPageFileId,
} from '../constants/widgetContent';

const TS_BASE = Date.now() - 7 * 24 * 60 * 60 * 1000;
const ts = (offset = 0) => TS_BASE + offset * 60 * 1000;

// ─── Shared field sets ─────────────────────────────────────────────────────────
const PROJECT_FIELDS: DatabaseField[] = [
  {
    id: 'f1',
    name: 'Name',
    type: 'text',
    options: [],
  },
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
  {
    id: 'f4',
    name: 'Due date',
    type: 'date',
    options: [],
  },
  {
    id: 'f5',
    name: 'Assignee',
    type: 'person',
    options: [],
  },
];

const PROJECT_RECORDS = [
  { id: 'r1', fields: { f1: 'Finalize edge-runtime migration guide', f2: 'In progress', f3: 'High', f4: '2026-03-02', f5: 'Maya' } },
  { id: 'r2', fields: { f1: 'Publish RAG eval benchmark write-up', f2: 'Not started', f3: 'Medium', f4: '2026-03-06', f5: 'Noah' } },
  { id: 'r3', fields: { f1: 'Patch OAuth callback race condition', f2: 'Done', f3: 'High', f4: '2026-02-24', f5: 'Ari' } },
  { id: 'r4', fields: { f1: 'Upgrade to React 19.2 + router audit', f2: 'In progress', f3: 'Medium', f4: '2026-03-08', f5: 'Lena' } },
  { id: 'r5', fields: { f1: 'Draft launch checklist for API beta', f2: 'Not started', f3: 'High', f4: '2026-03-10', f5: 'Devon' } },
  { id: 'r6', fields: { f1: 'Refactor dashboard hydration layer', f2: 'Done', f3: 'Medium', f4: '2026-02-21', f5: 'Maya' } },
  { id: 'r7', fields: { f1: 'Set up synthetic uptime monitors', f2: 'Not started', f3: 'Low', f4: '2026-03-14', f5: 'Noah' } },
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
  { id: 'wrr5', fields: { 'wr-f1': 'Send running-late text to PM', 'wr-f2': 'note' } },
  { id: 'wrr6', fields: { 'wr-f1': 'Block release-retro prep slot', 'wr-f2': 'block' } },
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
  { id: 'wtr4', fields: { 'wt-f1': 'Write release notes for v0.9.2', 'wt-f2': 'Maya', 'wt-f3': '2026-03-06' } },
  { id: 'wtr5', fields: { 'wt-f1': 'QA OAuth across Safari + Firefox', 'wt-f2': 'Devon', 'wt-f3': '2026-03-07' } },
  { id: 'wtr6', fields: { 'wt-f1': 'Publish post: context engineering 101', 'wt-f2': 'Ari', 'wt-f3': '2026-03-09' } },
  { id: 'wtr7', fields: { 'wt-f1': 'Record changelog walkthrough video', 'wt-f2': 'Noah', 'wt-f3': '2026-03-11' } },
];

const WIDGET_PAGE_RECORDS: DatabaseRecord[] = [
  {
    id: 'wpr1',
    fields: {
      'wp-f1': 'The Day We Replaced Standup with a Lighthouse',
      'wp-f2': 'Field Notes from Team Orbit',
      'wp-f3': 'Every morning at 9:03, the team gathered under a fake brass lighthouse in the corner of the office. Instead of saying what we did yesterday, we announced one risk, one weird signal, and one bet for today. Velocity did not magically double, but panic dropped, handoffs got cleaner, and blockers surfaced before lunch. The lesson was simple: progress sounds less like status and more like navigation.',
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
      'wp-f3': 'Most roadmaps fail from overgrowth, not neglect. We treated ours like bonsai: prune anything without a user story attached to a measurable behavior, wire branches to quarterly constraints, and repot once priorities start choking each other. The pretty part was accidental; the useful part was discipline. By month three, planning felt less like wishful gardening and more like deliberate architecture.',
      'wp-f4': 'Maxwell Moroz',
      'wp-f5': 'https://example.com/roadmap-bonsai',
      'wp-f6': 'large',
    },
  },
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

export async function seedData() {
  // ── 1. Rich-text page ───────────────────────────────────────────────────────
  const pageId = 'seed-page';
  const pageFile: WorkspaceFile = {
    id: pageId, kind: 'page', title: 'Block Types Showcase',
    author: 'Alice', createdAt: ts(0), updatedAt: ts(1),
    coverImageUrl: 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=800&q=60',
    tags: ['example', 'blocks'],
  };
  const pageDoc: PageDocument = {
    id: pageId,
    blocks: [
      { id: 'b1', type: 'heading1', text: 'Welcome to Notion App' },
      { id: 'b2', type: 'paragraph', text: 'This page demonstrates every core block type available in the editor.' },
      { id: 'b3', type: 'heading2', text: 'Text Blocks' },
      { id: 'b4', type: 'paragraph', text: 'Regular paragraph with plain text.' },
      { id: 'b5', type: 'heading3', text: 'Heading Level 3' },
      { id: 'b6', type: 'heading2', text: 'Lists' },
      { id: 'b7', type: 'bullet', text: 'Bullet item one' },
      { id: 'b8', type: 'bullet', text: 'Bullet item two' },
      { id: 'b9', type: 'bullet', text: 'Bullet item three' },
      { id: 'b10', type: 'numbered', text: 'First numbered item' },
      { id: 'b11', type: 'numbered', text: 'Second numbered item' },
      { id: 'b12', type: 'numbered', text: 'Third numbered item' },
      { id: 'b13', type: 'heading2', text: 'To-Do' },
      { id: 'b14', type: 'todo', text: 'Set up project', checked: true },
      { id: 'b15', type: 'todo', text: 'Write documentation', checked: false },
      { id: 'b16', type: 'todo', text: 'Deploy to production', checked: false },
      { id: 'b17', type: 'heading2', text: 'Toggle' },
      { id: 'b18', type: 'toggle', text: 'Click to expand hidden content', open: false, children: [
        { id: 'b18a', type: 'paragraph', text: 'This is the hidden content inside the toggle block.' },
      ]},
      { id: 'b19', type: 'heading2', text: 'Quote' },
      { id: 'b20', type: 'quote', text: 'The best way to predict the future is to invent it. — Alan Kay' },
      { id: 'b21', type: 'heading2', text: 'Callout' },
      { id: 'b22', type: 'callout', text: 'This is a callout block. Great for tips and warnings.', icon: '💡', color: '#fef9c3' },
      { id: 'b23', type: 'callout', text: 'Warning: Be careful with this operation.', icon: '⚠️', color: '#fecaca' },
      { id: 'b24', type: 'heading2', text: 'Divider' },
      { id: 'b25', type: 'divider' },
      { id: 'b26', type: 'paragraph', text: 'Content after the divider continues here.' },
      { id: 'b27', type: 'heading2', text: 'Image' },
      { id: 'b28', type: 'image', url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&q=60', caption: 'A beautiful code screenshot' },
    ],
  };
  await db.files.put(pageFile);
  await db.pages.put(pageDoc);

  // ── 2. Spreadsheet ──────────────────────────────────────────────────────────
  const sheetId = 'seed-sheet';
  const sheetFile: WorkspaceFile = {
    id: sheetId, kind: 'spreadsheet', title: 'Q1 Budget Tracker',
    author: 'Bob', createdAt: ts(10), updatedAt: ts(11),
    tags: ['finance', 'example'],
  };
  const sheetDoc: SpreadsheetDocument = {
    id: sheetId,
    columns: [
      { id: 'c1', name: 'Category', type: 'text' },
      { id: 'c2', name: 'Budget', type: 'number' },
      { id: 'c3', name: 'Actual', type: 'number' },
      { id: 'c4', name: 'Variance', type: 'number' },
      { id: 'c5', name: 'Approved', type: 'checkbox' },
    ],
    rows: [
      { id: 'sr1', cells: { c1: 'Engineering', c2: 50000, c3: 47200, c4: 2800, c5: true } },
      { id: 'sr2', cells: { c1: 'Marketing', c2: 20000, c3: 21500, c4: -1500, c5: true } },
      { id: 'sr3', cells: { c1: 'Design', c2: 15000, c3: 13800, c4: 1200, c5: true } },
      { id: 'sr4', cells: { c1: 'Infrastructure', c2: 8000, c3: 8400, c4: -400, c5: false } },
      { id: 'sr5', cells: { c1: 'HR', c2: 12000, c3: 11200, c4: 800, c5: true } },
      { id: 'sr6', cells: { c1: 'Operations', c2: 9500, c3: 10100, c4: -600, c5: false } },
      { id: 'sr7', cells: { c1: 'Legal', c2: 5000, c3: 4500, c4: 500, c5: true } },
    ],
  };
  await db.files.put(sheetFile);
  await db.spreadsheets.put(sheetDoc);

  // ── 3. Table database ───────────────────────────────────────────────────────
  const tableId = 'seed-table';
  const tableFile: WorkspaceFile = {
    id: tableId, kind: 'database', title: 'Project Tracker', viewKind: 'table',
    author: 'Alice', createdAt: ts(20), updatedAt: ts(21),
    tags: ['projects'],
  };
  const tableDoc: DatabaseDocument = {
    id: tableId, viewKind: 'table', schema: PROJECT_FIELDS,
    records: PROJECT_RECORDS, groupByField: 'f2', dateField: 'f4',
  };
  await db.files.put(tableFile);
  await db.databases.put(tableDoc);

  // ── 4. Board database ───────────────────────────────────────────────────────
  const boardId = 'seed-board';
  const boardFile: WorkspaceFile = {
    id: boardId, kind: 'database', title: 'Kanban Board', viewKind: 'board',
    author: 'Charlie', createdAt: ts(30), updatedAt: ts(31),
    tags: ['kanban'],
  };
  const boardDoc: DatabaseDocument = {
    id: boardId, viewKind: 'board', schema: PROJECT_FIELDS,
    records: PROJECT_RECORDS, groupByField: 'f2', dateField: 'f4',
  };
  await db.files.put(boardFile);
  await db.databases.put(boardDoc);

  // ── 5. Calendar database ────────────────────────────────────────────────────
  const calId = 'seed-calendar';
  const calFile: WorkspaceFile = {
    id: calId, kind: 'database', title: 'Calendar', viewKind: 'calendar',
    author: 'Bob', createdAt: ts(40), updatedAt: ts(41),
    tags: ['calendar', 'schedule'],
  };
  const calDoc: DatabaseDocument = {
    id: calId, viewKind: 'calendar', schema: PROJECT_FIELDS,
    records: PROJECT_RECORDS, groupByField: 'f2', dateField: 'f4',
  };
  await db.files.put(calFile);
  await db.databases.put(calDoc);

  // ── 6. Gallery database ─────────────────────────────────────────────────────
  const galleryId = 'seed-gallery';
  const galleryFields: DatabaseField[] = [
    { id: 'gf1', name: 'Title', type: 'text', options: [] },
    { id: 'gf2', name: 'Category', type: 'select', options: [
      { id: 'gc1', label: 'Nature', color: '#bbf7d0' },
      { id: 'gc2', label: 'City', color: '#bfdbfe' },
      { id: 'gc3', label: 'Tech', color: '#e9d5ff' },
    ]},
    { id: 'gf3', name: 'Image', type: 'url', options: [] },
    { id: 'gf4', name: 'Featured', type: 'checkbox', options: [] },
  ];
  const galleryFile: WorkspaceFile = {
    id: galleryId, kind: 'database', title: 'Photo Gallery', viewKind: 'gallery',
    author: 'Alice', createdAt: ts(50), updatedAt: ts(51),
    tags: ['gallery', 'media'],
  };
  const galleryDoc: DatabaseDocument = {
    id: galleryId, viewKind: 'gallery', schema: galleryFields,
    records: [
      { id: 'gr1', fields: { gf1: 'Mountain Sunrise', gf2: 'Nature', gf3: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=60', gf4: true } },
      { id: 'gr2', fields: { gf1: 'Night Skyline', gf2: 'City', gf3: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400&q=60', gf4: true } },
      { id: 'gr3', fields: { gf1: 'Code on Screen', gf2: 'Tech', gf3: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&q=60', gf4: false } },
      { id: 'gr4', fields: { gf1: 'Ocean Waves', gf2: 'Nature', gf3: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=400&q=60', gf4: true } },
      { id: 'gr5', fields: { gf1: 'Coffee Shop', gf2: 'City', gf3: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&q=60', gf4: false } },
      { id: 'gr6', fields: { gf1: 'Circuit Board', gf2: 'Tech', gf3: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&q=60', gf4: true } },
    ],
  };
  await db.files.put(galleryFile);
  await db.databases.put(galleryDoc);

  // ── 7. List database ────────────────────────────────────────────────────────
  const listId = 'seed-list';
  const listFields: DatabaseField[] = [
    { id: 'lf1', name: 'Task', type: 'text', options: [] },
    { id: 'lf2', name: 'Done', type: 'checkbox', options: [] },
    { id: 'lf3', name: 'Priority', type: 'select', options: [
      { id: 'lp1', label: 'Low', color: '#fef9c3' },
      { id: 'lp2', label: 'Medium', color: '#fed7aa' },
      { id: 'lp3', label: 'High', color: '#fecaca' },
    ]},
    { id: 'lf4', name: 'Due', type: 'date', options: [] },
  ];
  const listFile: WorkspaceFile = {
    id: listId, kind: 'database', title: 'Weekly Tasks', viewKind: 'list',
    author: 'Charlie', createdAt: ts(60), updatedAt: ts(61),
    tags: ['tasks'],
  };
  const listDoc: DatabaseDocument = {
    id: listId, viewKind: 'list', schema: listFields,
    records: [
      { id: 'lr1', fields: { lf1: 'Review pull requests', lf2: true, lf3: 'High', lf4: '2026-02-20' } },
      { id: 'lr2', fields: { lf1: 'Team standup', lf2: true, lf3: 'Medium', lf4: '2026-02-20' } },
      { id: 'lr3', fields: { lf1: 'Write sprint summary', lf2: false, lf3: 'Medium', lf4: '2026-02-21' } },
      { id: 'lr4', fields: { lf1: 'Update roadmap doc', lf2: false, lf3: 'High', lf4: '2026-02-22' } },
      { id: 'lr5', fields: { lf1: 'Backlog grooming', lf2: false, lf3: 'Low', lf4: '2026-02-24' } },
      { id: 'lr6', fields: { lf1: 'Interview candidate', lf2: false, lf3: 'High', lf4: '2026-02-25' } },
      { id: 'lr7', fields: { lf1: 'Deploy new version', lf2: false, lf3: 'High', lf4: '2026-02-26' } },
      { id: 'lr8', fields: { lf1: 'Write test cases', lf2: false, lf3: 'Medium', lf4: '2026-02-27' } },
    ],
  };
  await db.files.put(listFile);
  await db.databases.put(listDoc);

  // Seed widget databases too
  await seedWidgetDatabases();
}

// ── Exported separately so existing users get the widget DBs ────────────────
export async function seedWidgetDatabases() {
  // ── 8. Widget Pages database ──────────────────────────────────────────────
  const wpId = 'seed-widget-pages';
  const wpFields: DatabaseField[] = [
    { id: 'wp-f1', name: 'Title', type: 'text', options: [] },
    { id: 'wp-f2', name: 'Subtitle', type: 'text', options: [] },
    { id: 'wp-f3', name: 'Body', type: 'text', options: [] },
    { id: 'wp-f4', name: 'Author', type: 'text', options: [] },
    { id: 'wp-f5', name: 'Link', type: 'url', options: [] },
    { id: 'wp-f6', name: 'Size', type: 'select', options: [
      { id: 'wps1', label: 'small', color: '#bfdbfe' },
      { id: 'wps2', label: 'large', color: '#e9d5ff' },
    ]},
  ];
  const wpFile: WorkspaceFile = {
    id: wpId, kind: 'database', title: 'Widget Pages', viewKind: 'table',
    author: 'System', createdAt: ts(70), updatedAt: ts(71),
    tags: ['widgets'],
  };
  const wpDoc: DatabaseDocument = {
    id: wpId, viewKind: 'table', schema: wpFields,
    records: WIDGET_PAGE_RECORDS,
  };
  await db.files.put(wpFile);
  await db.databases.put(wpDoc);

  // ── 9. Widget Notifications database ──────────────────────────────────────
  const wnId = 'seed-widget-notifs';
  const wnFields: DatabaseField[] = [
    { id: 'wn-f1', name: 'Title', type: 'text', options: [] },
    { id: 'wn-f2', name: 'Description', type: 'text', options: [] },
    { id: 'wn-f3', name: 'Time', type: 'text', options: [] },
  ];
  const wnFile: WorkspaceFile = {
    id: wnId, kind: 'database', title: 'Widget Notifications', viewKind: 'table',
    author: 'System', createdAt: ts(80), updatedAt: ts(81),
    tags: ['widgets'],
  };
  const wnDoc: DatabaseDocument = {
    id: wnId, viewKind: 'table', schema: wnFields,
    records: [
      { id: 'wnr1', fields: { 'wn-f1': 'Title', 'wn-f2': 'Description', 'wn-f3': '9:41 AM' } },
      { id: 'wnr2', fields: { 'wn-f1': 'Title', 'wn-f2': 'Description', 'wn-f3': '9:41 AM' } },
      { id: 'wnr3', fields: { 'wn-f1': 'Title', 'wn-f2': 'Description', 'wn-f3': '9:41 AM' } },
    ],
  };
  await db.files.put(wnFile);
  await db.databases.put(wnDoc);

  // ── 10. Widget Reminders database ─────────────────────────────────────────
  const wrId = 'seed-widget-reminders';
  const wrFile: WorkspaceFile = {
    id: wrId, kind: 'database', title: 'Widget Reminders', viewKind: 'table',
    author: 'System', createdAt: ts(90), updatedAt: ts(91),
    tags: ['widgets'],
  };
  const wrDoc: DatabaseDocument = {
    id: wrId, viewKind: 'table', schema: WIDGET_REMINDER_FIELDS,
    records: WIDGET_REMINDER_RECORDS,
  };
  await db.files.put(wrFile);
  await db.databases.put(wrDoc);

  // ── 11. Widget Todos database ────────────────────────────────────────────
  const wtId = WIDGET_TODOS_DB_ID;
  const wtFile: WorkspaceFile = {
    id: wtId, kind: 'database', title: 'Widget Todos', viewKind: 'table',
    author: 'System', createdAt: ts(92), updatedAt: ts(93),
    tags: ['widgets'],
  };
  const wtDoc: DatabaseDocument = {
    id: wtId, viewKind: 'table', schema: WIDGET_TODO_FIELDS,
    records: WIDGET_TODO_RECORDS,
  };
  await db.files.put(wtFile);
  await db.databases.put(wtDoc);

  // ── 12. Widget Media database ────────────────────────────────────────────
  const wmId = WIDGET_MEDIA_DB_ID;
  const wmFile: WorkspaceFile = {
    id: wmId, kind: 'database', title: 'Widget Media', viewKind: 'table',
    author: 'System', createdAt: ts(94), updatedAt: ts(95),
    tags: ['widgets'],
  };
  const wmDoc: DatabaseDocument = {
    id: wmId, viewKind: 'table', schema: WIDGET_MEDIA_FIELDS,
    records: WIDGET_MEDIA_RECORDS,
  };
  await db.files.put(wmFile);
  await db.databases.put(wmDoc);
}

function readRecordString(rec: DatabaseRecord, fieldId: string) {
  const value = rec.fields[fieldId];
  if (value == null) return '';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

async function ensureCalendarDatabase() {
  const calFile = await db.files.get(CALENDAR_DB_ID);

  const file: WorkspaceFile = {
    id: CALENDAR_DB_ID,
    kind: 'database',
    title: 'Calendar',
    viewKind: 'calendar',
    author: 'Bob',
    createdAt: calFile?.createdAt ?? ts(40),
    updatedAt: now(),
    tags: ['calendar', 'schedule'],
  };
  const doc: DatabaseDocument = {
    id: CALENDAR_DB_ID,
    viewKind: 'calendar',
    schema: PROJECT_FIELDS,
    records: PROJECT_RECORDS,
    groupByField: 'f2',
    dateField: 'f4',
  };
  await db.files.put(file);
  await db.databases.put(doc);
}

async function ensureWidgetPagesDatabase() {
  const existingFile = await db.files.get(WIDGET_PAGES_DB_ID);
  const wpFields: DatabaseField[] = [
    { id: 'wp-f1', name: 'Title', type: 'text', options: [] },
    { id: 'wp-f2', name: 'Subtitle', type: 'text', options: [] },
    { id: 'wp-f3', name: 'Body', type: 'text', options: [] },
    { id: 'wp-f4', name: 'Author', type: 'text', options: [] },
    { id: 'wp-f5', name: 'Link', type: 'url', options: [] },
    { id: 'wp-f6', name: 'Size', type: 'select', options: [
      { id: 'wps1', label: 'small', color: '#bfdbfe' },
      { id: 'wps2', label: 'large', color: '#e9d5ff' },
    ]},
  ];
  const file: WorkspaceFile = {
    id: WIDGET_PAGES_DB_ID,
    kind: 'database',
    title: 'Widget Pages',
    viewKind: 'table',
    author: 'System',
    createdAt: existingFile?.createdAt ?? ts(70),
    updatedAt: now(),
    tags: ['widgets'],
  };
  const doc: DatabaseDocument = {
    id: WIDGET_PAGES_DB_ID,
    viewKind: 'table',
    schema: wpFields,
    records: WIDGET_PAGE_RECORDS,
  };
  await db.files.put(file);
  await db.databases.put(doc);
}

async function ensureWidgetRemindersDatabase() {
  const existingFile = await db.files.get(WIDGET_REMINDERS_DB_ID);

  const file: WorkspaceFile = {
    id: WIDGET_REMINDERS_DB_ID,
    kind: 'database',
    title: 'Widget Reminders',
    viewKind: 'table',
    author: 'System',
    createdAt: existingFile?.createdAt ?? ts(90),
    updatedAt: now(),
    tags: ['widgets'],
  };
  const doc: DatabaseDocument = {
    id: WIDGET_REMINDERS_DB_ID,
    viewKind: 'table',
    schema: WIDGET_REMINDER_FIELDS,
    records: WIDGET_REMINDER_RECORDS,
  };

  await db.files.put(file);
  await db.databases.put(doc);
}

async function ensureWidgetTodosDatabase() {
  const existingFile = await db.files.get(WIDGET_TODOS_DB_ID);

  const file: WorkspaceFile = {
    id: WIDGET_TODOS_DB_ID,
    kind: 'database',
    title: 'Widget Todos',
    viewKind: 'table',
    author: 'System',
    createdAt: existingFile?.createdAt ?? ts(92),
    updatedAt: now(),
    tags: ['widgets'],
  };
  const doc: DatabaseDocument = {
    id: WIDGET_TODOS_DB_ID,
    viewKind: 'table',
    schema: WIDGET_TODO_FIELDS,
    records: WIDGET_TODO_RECORDS,
  };

  await db.files.put(file);
  await db.databases.put(doc);
}

async function ensureWidgetMediaDatabase() {
  const existingFile = await db.files.get(WIDGET_MEDIA_DB_ID);
  const file: WorkspaceFile = {
    id: WIDGET_MEDIA_DB_ID,
    kind: 'database',
    title: 'Widget Media',
    viewKind: 'table',
    author: 'System',
    createdAt: existingFile?.createdAt ?? ts(94),
    updatedAt: now(),
    tags: ['widgets'],
  };
  const doc: DatabaseDocument = {
    id: WIDGET_MEDIA_DB_ID,
    viewKind: 'table',
    schema: WIDGET_MEDIA_FIELDS,
    records: WIDGET_MEDIA_RECORDS,
  };
  await db.files.put(file);
  await db.databases.put(doc);
}

async function syncWidgetPageFiles() {
  const dbDoc = await db.databases.get(WIDGET_PAGES_DB_ID);
  const keepIds = new Set<string>();
  if (!dbDoc) return keepIds;

  const idByName = Object.fromEntries(dbDoc.schema.map(field => [field.name, field.id]));
  const titleFieldId = idByName['Title'];
  const subtitleFieldId = idByName['Subtitle'];
  const bodyFieldId = idByName['Body'];
  const authorFieldId = idByName['Author'];
  const linkFieldId = idByName['Link'];

  if (!titleFieldId || !bodyFieldId || !authorFieldId) return keepIds;

  for (const rec of dbDoc.records) {
    const pageId = widgetPageFileId(rec.id);
    keepIds.add(pageId);

    const title = readRecordString(rec, titleFieldId) || 'Untitled';
    const subtitle = subtitleFieldId ? readRecordString(rec, subtitleFieldId) : '';
    const body = readRecordString(rec, bodyFieldId);
    const author = readRecordString(rec, authorFieldId) || 'System';
    const link = linkFieldId ? readRecordString(rec, linkFieldId) : '';

    const existingFile = await db.files.get(pageId);
    const createdAt = existingFile?.createdAt ?? now();
    const updatedAt = now();

    const file: WorkspaceFile = {
      id: pageId,
      kind: 'page',
      title,
      author,
      createdAt,
      updatedAt,
      tags: ['widget-page'],
    };
    const pageDoc: PageDocument = {
      id: pageId,
      blocks: [
        { id: `${pageId}-heading`, type: 'heading1', text: title },
        ...(subtitle ? [{ id: `${pageId}-subtitle`, type: 'paragraph', text: subtitle } as const] : []),
        ...(body ? [{ id: `${pageId}-body`, type: 'paragraph', text: body } as const] : []),
        { id: `${pageId}-author`, type: 'paragraph', text: `By ${author}` },
        ...(link ? [{ id: `${pageId}-link`, type: 'paragraph', text: `Link: ${link}` } as const] : []),
      ],
    };

    await db.files.put(file);
    await db.pages.put(pageDoc);
  }

  const existingWidgetPages = (await db.files.where('kind').equals('page').toArray())
    .filter(file => isWidgetPageFileId(file.id));
  for (const file of existingWidgetPages) {
    if (keepIds.has(file.id)) continue;
    await db.files.delete(file.id);
    await db.pages.delete(file.id);
  }

  return keepIds;
}

function now() {
  return Date.now();
}

export async function enforceWidgetCalendarOnlyContent() {
  await ensureCalendarDatabase();
  await ensureWidgetPagesDatabase();
  await ensureWidgetRemindersDatabase();
  await ensureWidgetTodosDatabase();
  await ensureWidgetMediaDatabase();

  const hasWidgetPages = await db.files.get(WIDGET_PAGES_DB_ID);
  const hasWidgetReminders = await db.files.get(WIDGET_REMINDERS_DB_ID);
  const hasWidgetTodos = await db.files.get(WIDGET_TODOS_DB_ID);
  const hasWidgetMedia = await db.files.get(WIDGET_MEDIA_DB_ID);
  if (!hasWidgetPages || !hasWidgetReminders || !hasWidgetTodos || !hasWidgetMedia) {
    await seedWidgetDatabases();
  }

  const keepPageIds = await syncWidgetPageFiles();
  const keepDbIds = new Set<string>(ALLOWED_DATABASE_IDS);
  const files = await db.files.toArray();

  for (const file of files) {
    if (file.kind === 'spreadsheet') {
      await db.files.delete(file.id);
      await db.spreadsheets.delete(file.id);
      continue;
    }
    if (file.kind === 'database' && !keepDbIds.has(file.id)) {
      await db.files.delete(file.id);
      await db.databases.delete(file.id);
      continue;
    }
    if (file.kind === 'page' && !keepPageIds.has(file.id)) {
      await db.files.delete(file.id);
      await db.pages.delete(file.id);
    }
  }

  const activeFiles = new Set((await db.files.toArray()).map(file => file.id));
  for (const page of await db.pages.toArray()) {
    if (!activeFiles.has(page.id)) await db.pages.delete(page.id);
  }
  for (const sheet of await db.spreadsheets.toArray()) {
    if (!activeFiles.has(sheet.id)) await db.spreadsheets.delete(sheet.id);
  }
  for (const database of await db.databases.toArray()) {
    if (!activeFiles.has(database.id)) await db.databases.delete(database.id);
  }
}
