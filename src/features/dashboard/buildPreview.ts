import { getPage, getSpreadsheet, getDatabase } from '../../shared/store/fileStore';
import type {
  WorkspaceFile, DashboardPreview,
  PageDocument, TextBlock,
} from '../../shared/types';

export async function buildSinglePreview(file: WorkspaceFile, viewKindOverride?: string): Promise<DashboardPreview | null> {
  if (file.kind === 'page') {
    const doc = await getPage(file.id);
    const snippet = extractSnippet(doc);
    const imageUrl = extractImage(doc) ?? file.coverImageUrl;
    return { kind: 'page', file, snippet, imageUrl };
  } else if (file.kind === 'spreadsheet') {
    const doc = await getSpreadsheet(file.id);
    return {
      kind: 'spreadsheet', file,
      columns: doc?.columns ?? [],
      rows: (doc?.rows ?? []).slice(0, 5),
    };
  } else if (file.kind === 'database') {
    const doc = await getDatabase(file.id);
    const effectiveViewKind = viewKindOverride ?? file.viewKind;
    if (effectiveViewKind === 'calendar' && doc) {
      const dateField = doc.schema.find(f => f.id === doc.dateField) ?? doc.schema.find(f => f.type === 'date');
      return {
        kind: 'calendar', file,
        records: doc.records,
        dateField: dateField?.id ?? '',
        titleField: doc.schema[0]?.id ?? '',
        schema: doc.schema,
      };
    } else {
      return {
        kind: 'database', file,
        viewKind: (effectiveViewKind ?? 'table') as import('../../shared/types').DatabaseViewKind,
        recordCount: doc?.records.length ?? 0,
        records: doc?.records,
        schema: doc?.schema,
        groupByField: doc?.groupByField,
      };
    }
  }
  return null;
}

function extractSnippet(doc?: PageDocument, maxLen = 120): string {
  if (!doc) return '';
  for (const block of doc.blocks) {
    if ('text' in block && (block as TextBlock).text) {
      const t = (block as TextBlock).text.trim();
      if (t) return t.length > maxLen ? t.slice(0, maxLen) + '…' : t;
    }
  }
  return '';
}

function extractImage(doc?: PageDocument): string | undefined {
  if (!doc) return undefined;
  const img = doc.blocks.find(b => b.type === 'image');
  return img && 'url' in img ? (img as { url: string }).url : undefined;
}
