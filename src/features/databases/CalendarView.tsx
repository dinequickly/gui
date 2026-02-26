import React, { useState } from 'react';
import type { DatabaseDocument, DatabaseRecord } from '../../shared/types';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek,
  getDay, isToday, isSameMonth, addDays, addWeeks, addMonths,
  subDays, subWeeks, subMonths,
} from 'date-fns';

type ViewRange = 'day' | 'week' | 'month';

interface Props {
  doc: DatabaseDocument;
  compact?: boolean;
  /** Preview mode: styled like the full calendar page but no nav/toggle, smaller cells */
  preview?: boolean;
}

// ─── Event card (used in full view) ──────────────────────────────────────────
interface EventCardProps {
  rec: DatabaseRecord;
  nameFieldId?: string;
  personFieldId?: string;
  categoryFieldId?: string;
  categoryOptions?: { id: string; label: string; color: string }[];
  locationFieldId?: string;
}

function EventCard({ rec, nameFieldId, personFieldId, categoryFieldId, categoryOptions, locationFieldId }: EventCardProps) {
  const title = nameFieldId ? String(rec.fields[nameFieldId] ?? 'Untitled') : 'Untitled';
  const person = personFieldId ? String(rec.fields[personFieldId] ?? '') : '';
  const category = categoryFieldId ? String(rec.fields[categoryFieldId] ?? '') : '';
  const location = locationFieldId ? String(rec.fields[locationFieldId] ?? '') : '';
  const catOpt = categoryOptions?.find(o => o.label === category);
  const hasDetails = !!(person || location || category);

  return (
    <div style={{
      background: '#fff', borderRadius: 8, border: '1px solid #e8e8e7',
      padding: '8px 10px', marginBottom: 5,
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{
        fontWeight: 600, fontSize: 12, color: '#111',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        marginBottom: hasDetails ? 4 : 0,
      }}>
        {title}
      </div>
      {person && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: location || category ? 3 : 0 }}>
          <div style={{
            width: 14, height: 14, borderRadius: '50%', background: '#d1d5db',
            flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="8" height="8" viewBox="0 0 8 8" fill="#9ca3af">
              <circle cx="4" cy="3" r="2" />
              <path d="M1 7c0-1.66 1.34-3 3-3s3 1.34 3 3" />
            </svg>
          </div>
          <span style={{ fontSize: 11, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {person}
          </span>
        </div>
      )}
      {location && (
        <div style={{ fontSize: 11, color: '#777', marginBottom: category ? 4 : 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {location}
        </div>
      )}
      {category && (
        <span style={{
          display: 'inline-block', fontSize: 10, padding: '2px 8px', borderRadius: 10,
          background: catOpt?.color ? `${catOpt.color}30` : '#ede9fe',
          color: catOpt?.color ?? '#7c3aed',
        }}>
          {category}
        </span>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function CalendarView({ doc, compact = false, preview = false }: Props) {
  const [current, setCurrent] = useState(new Date());
  const [viewRange, setViewRange] = useState<ViewRange>('month');

  const dateField = doc.schema.find(f => f.id === doc.dateField) ?? doc.schema.find(f => f.type === 'date');
  const nameField = doc.schema[0];
  const personField = doc.schema.find(f => f.type === 'person');
  const categoryField = doc.schema.find(f => f.type === 'select');
  const locationField = doc.schema.find(f => f.type === 'text' && f.id !== nameField?.id);

  // Build event map: 'yyyy-MM-dd' → records
  const eventMap: Record<string, DatabaseRecord[]> = {};
  if (dateField) {
    for (const rec of doc.records) {
      const d = rec.fields[dateField.id];
      if (typeof d === 'string' && d) {
        (eventMap[d] ??= []).push(rec);
      }
    }
  }

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const cardProps = {
    nameFieldId: nameField?.id,
    personFieldId: personField?.id,
    categoryFieldId: categoryField?.id,
    categoryOptions: categoryField?.options,
    locationFieldId: locationField?.id,
  };

  // ── Compact preview (dot indicators) ──────────────────────────────────────
  if (compact) {
    const monthStart = startOfMonth(current);
    const monthEnd = endOfMonth(current);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startDay = getDay(monthStart);
    return (
      <div style={{ fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <button onClick={() => setCurrent(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} style={navBtn}>‹</button>
          <span style={{ fontWeight: 600, fontSize: 12, minWidth: 110, textAlign: 'center', color: '#333' }}>
            {format(current, 'MMMM yyyy')}
          </span>
          <button onClick={() => setCurrent(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} style={navBtn}>›</button>
        </div>
        <div style={{ border: '1px solid #e2e2e0', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f7f7f5' }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 9, fontWeight: 600, color: '#888', padding: '3px 0', borderRight: '1px solid #e9e9e7' }}>
                {d.charAt(0)}
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {Array.from({ length: startDay }).map((_, i) => (
              <div key={`pad-${i}`} style={{ height: 28, borderRight: '1px solid #f0f0ef', borderBottom: '1px solid #f0f0ef', background: '#fafafa' }} />
            ))}
            {days.map(day => {
              const key = format(day, 'yyyy-MM-dd');
              const hasEvents = (eventMap[key]?.length ?? 0) > 0;
              const today = isToday(day);
              return (
                <div key={key} style={{ height: 28, borderRight: '1px solid #f0f0ef', borderBottom: '1px solid #f0f0ef', padding: 2, position: 'relative', background: '#fff' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 16, height: 16, borderRadius: '50%', fontSize: 9,
                    background: today ? '#ef4444' : 'transparent',
                    color: today ? '#fff' : '#555', fontWeight: today ? 700 : 400,
                  }}>
                    {day.getDate()}
                  </span>
                  {hasEvents && (
                    <div style={{ position: 'absolute', bottom: 2, right: 2, width: 4, height: 4, borderRadius: '50%', background: '#3b82f6' }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Preview mode: full-style month grid, no nav ────────────────────────────
  if (preview) {
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    const allDays = eachDayOfInterval({ start: calStart, end: calEnd });
    return (
      <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {/* Month label */}
        <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 8, letterSpacing: '0.03em' }}>
          {format(new Date(), 'MMMM yyyy')}
        </div>
        <div style={{ border: '1px solid #e2e2e0', borderRadius: 8, overflow: 'hidden' }}>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#fafafa', borderBottom: '1px solid #e2e2e0' }}>
            {DAYS.map(d => (
              <div key={d} style={{ padding: '5px 0', textAlign: 'center', fontSize: 9, fontWeight: 600, color: '#aaa', letterSpacing: '0.04em' }}>
                {d.toUpperCase()}
              </div>
            ))}
          </div>
          {/* Day cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {allDays.map(day => {
              const key = format(day, 'yyyy-MM-dd');
              const events = eventMap[key] ?? [];
              const today = isToday(day);
              const inMonth = isSameMonth(day, new Date());
              return (
                <div key={key} style={{
                  minHeight: 52, borderRight: '1px solid #efefee', borderBottom: '1px solid #efefee',
                  padding: '4px 5px', overflow: 'hidden',
                  background: inMonth ? '#fff' : '#fafafa',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 2 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 18, height: 18, borderRadius: '50%', fontSize: 9,
                      background: today ? '#ef4444' : 'transparent',
                      color: today ? '#fff' : inMonth ? '#333' : '#ccc',
                      fontWeight: today ? 700 : 400,
                    }}>
                      {day.getDate()}
                    </span>
                  </div>
                  {inMonth && events.slice(0, 2).map(rec => {
                    const title = nameField ? String(rec.fields[nameField.id] ?? '') : '';
                    const category = categoryField ? String(rec.fields[categoryField.id] ?? '') : '';
                    const catOpt = categoryField?.options?.find(o => o.label === category);
                    return (
                      <div key={rec.id} style={{
                        background: '#fff', borderRadius: 4, border: '1px solid #e8e8e7',
                        padding: '3px 5px', marginBottom: 3,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                      }}>
                        <div style={{ fontSize: 9, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: category ? 2 : 0 }}>
                          {title}
                        </div>
                        {category && (
                          <span style={{
                            display: 'inline-block', fontSize: 8, padding: '1px 5px', borderRadius: 8,
                            background: catOpt?.color ? `${catOpt.color}30` : '#ede9fe',
                            color: catOpt?.color ?? '#7c3aed',
                          }}>
                            {category}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {inMonth && events.length > 2 && (
                    <div style={{ fontSize: 8, color: '#bbb' }}>+{events.length - 2}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  function prev() {
    if (viewRange === 'day') setCurrent(d => subDays(d, 1));
    else if (viewRange === 'week') setCurrent(d => subWeeks(d, 1));
    else setCurrent(d => subMonths(d, 1));
  }
  function next() {
    if (viewRange === 'day') setCurrent(d => addDays(d, 1));
    else if (viewRange === 'week') setCurrent(d => addWeeks(d, 1));
    else setCurrent(d => addMonths(d, 1));
  }

  let headerLabel = '';
  if (viewRange === 'day') {
    headerLabel = format(current, 'EEEE, MMMM d, yyyy');
  } else if (viewRange === 'week') {
    const ws = startOfWeek(current, { weekStartsOn: 1 });
    headerLabel = `${format(ws, 'MMM d')} – ${format(addDays(ws, 4), 'MMM d, yyyy')}`;
  } else {
    headerLabel = format(current, 'MMMM yyyy');
  }

  // ── Full view ──────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={prev} style={navBtn}>‹</button>
          <span style={{ fontWeight: 600, fontSize: 15, color: '#1a1a1a', minWidth: 200 }}>{headerLabel}</span>
          <button onClick={next} style={navBtn}>›</button>
          <button
            onClick={() => setCurrent(new Date())}
            style={{ ...navBtn, fontSize: 12, padding: '0 12px', width: 'auto', borderRadius: 6 }}
          >
            Today
          </button>
        </div>
        {/* 1D / 5D / Month toggle */}
        <div style={{ display: 'flex', border: '1px solid #e2e2e0', borderRadius: 6, overflow: 'hidden' }}>
          {(['day', 'week', 'month'] as const).map((r, idx) => (
            <button key={r} onClick={() => setViewRange(r)} style={{
              padding: '5px 13px',
              background: viewRange === r ? '#1a1a1a' : '#fff',
              color: viewRange === r ? '#fff' : '#666',
              border: 'none',
              borderRight: idx < 2 ? '1px solid #e2e2e0' : 'none',
              cursor: 'pointer', fontSize: 12, fontWeight: 500,
            }}>
              {r === 'day' ? '1D' : r === 'week' ? '5D' : 'Month'}
            </button>
          ))}
        </div>
      </div>

      {/* ── MONTH VIEW ─────────────────────────────────────────────────────── */}
      {viewRange === 'month' && (() => {
        const monthStart = startOfMonth(current);
        const monthEnd = endOfMonth(current);
        const calStart = startOfWeek(monthStart);
        const calEnd = endOfWeek(monthEnd);
        const allDays = eachDayOfInterval({ start: calStart, end: calEnd });
        return (
          <div style={{ border: '1px solid #e2e2e0', borderRadius: 10, overflow: 'hidden' }}>
            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #e2e2e0', background: '#fafafa' }}>
              {DAYS.map(d => (
                <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#aaa', letterSpacing: '0.04em' }}>
                  {d.toUpperCase()}
                </div>
              ))}
            </div>
            {/* Day cells */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {allDays.map(day => {
                const key = format(day, 'yyyy-MM-dd');
                const events = eventMap[key] ?? [];
                const today = isToday(day);
                const inMonth = isSameMonth(day, current);
                return (
                  <div key={key} style={{
                    minHeight: 110,
                    borderRight: '1px solid #efefee',
                    borderBottom: '1px solid #efefee',
                    padding: '6px 8px',
                    overflow: 'hidden',
                    background: inMonth ? '#fff' : '#fafafa',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 5 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 26, height: 26, borderRadius: '50%', fontSize: 13,
                        background: today ? '#ef4444' : 'transparent',
                        color: today ? '#fff' : inMonth ? '#333' : '#ccc',
                        fontWeight: today ? 700 : 400,
                      }}>
                        {day.getDate()}
                      </span>
                    </div>
                    {inMonth && events.slice(0, 3).map(rec => (
                      <EventCard key={rec.id} rec={rec} {...cardProps} />
                    ))}
                    {inMonth && events.length > 3 && (
                      <div style={{ fontSize: 10, color: '#bbb', marginTop: 2 }}>+{events.length - 3} more</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── 5D WEEK VIEW (Mon–Fri) ──────────────────────────────────────────── */}
      {viewRange === 'week' && (() => {
        const ws = startOfWeek(current, { weekStartsOn: 1 });
        const weekDays = Array.from({ length: 5 }, (_, i) => addDays(ws, i));
        return (
          <div style={{ border: '1px solid #e2e2e0', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', borderBottom: '1px solid #e2e2e0', background: '#fafafa' }}>
              {weekDays.map(d => {
                const today = isToday(d);
                return (
                  <div key={d.toISOString()} style={{ padding: '10px 12px', borderRight: '1px solid #efefee' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', letterSpacing: '0.04em' }}>
                      {format(d, 'EEE').toUpperCase()}
                    </div>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 30, height: 30, borderRadius: '50%', fontSize: 15,
                      background: today ? '#ef4444' : 'transparent',
                      color: today ? '#fff' : '#333',
                      fontWeight: today ? 700 : 400, marginTop: 4,
                    }}>
                      {format(d, 'd')}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)' }}>
              {weekDays.map(d => {
                const key = format(d, 'yyyy-MM-dd');
                const events = eventMap[key] ?? [];
                return (
                  <div key={key} style={{ padding: 10, borderRight: '1px solid #efefee', minHeight: 240 }}>
                    {events.map(rec => <EventCard key={rec.id} rec={rec} {...cardProps} />)}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── 1D DAY VIEW ────────────────────────────────────────────────────── */}
      {viewRange === 'day' && (() => {
        const key = format(current, 'yyyy-MM-dd');
        const events = eventMap[key] ?? [];
        const today = isToday(current);
        return (
          <div style={{ border: '1px solid #e2e2e0', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', background: '#fafafa', borderBottom: '1px solid #e2e2e0', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 42, height: 42, borderRadius: '50%', fontSize: 20,
                background: today ? '#ef4444' : '#f0f0ef',
                color: today ? '#fff' : '#333', fontWeight: 700,
              }}>
                {format(current, 'd')}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a' }}>{format(current, 'EEEE')}</div>
                <div style={{ fontSize: 13, color: '#888' }}>{format(current, 'MMMM yyyy')}</div>
              </div>
            </div>
            <div style={{ padding: '14px 18px', minHeight: 240 }}>
              {events.length === 0 ? (
                <div style={{ color: '#ccc', fontSize: 13, textAlign: 'center', paddingTop: 60 }}>No events</div>
              ) : (
                events.map(rec => <EventCard key={rec.id} rec={rec} {...cardProps} />)
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

const navBtn: React.CSSProperties = {
  background: '#fff', border: '1px solid #e2e2e0', borderRadius: 6,
  cursor: 'pointer', fontSize: 15, color: '#555', width: 30, height: 30,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
};
