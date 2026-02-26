import type { CalendarPreview, DatabaseDocument } from '../../shared/types';
import { CalendarView } from '../databases/CalendarView';

interface Props {
  preview: CalendarPreview;
}

export function CalendarPreviewCard({ preview }: Props) {
  const { file, records, dateField, titleField, schema } = preview;

  const fakeDoc: DatabaseDocument = {
    id: file.id,
    viewKind: 'calendar',
    schema: schema ?? [
      { id: titleField, name: 'Name', type: 'text', options: [] },
      { id: dateField, name: 'Date', type: 'date', options: [] },
    ],
    records,
    dateField,
  };

  return (
    <div style={{ padding: '10px 12px 12px' }}>
      <CalendarView doc={fakeDoc} preview={true} />
    </div>
  );
}
