import notif1 from '../../../assets/notif-1.png';
import notif2 from '../../../assets/notif-2.png';
import notif3 from '../../../assets/notif-3.png';
import { GlassCardShell } from './GlassCardShell';
import type { WidgetComponentProps } from '../types';

interface ReminderRow {
  title: string;
  subtitle: string;
  time: string;
}

interface ReminderListProps {
  rows: ReminderRow[];
}

const ICONS = [notif1, notif2, notif3];

export function ReminderList({ item }: WidgetComponentProps) {
  const { rows } = item.props as unknown as ReminderListProps;

  return (
    <GlassCardShell width={item.width} height={item.height} className="reminder-card-shell">
      <div className="reminder-list">
        {rows.map((row, idx) => (
          <article className="reminder-row" key={`${row.title}-${idx}`}>
            <img src={ICONS[idx % ICONS.length]} alt="" />
            <div>
              <p className="title">{row.title}</p>
              <p className="subtitle">{row.subtitle}</p>
            </div>
            <span>{row.time}</span>
          </article>
        ))}
      </div>
    </GlassCardShell>
  );
}
