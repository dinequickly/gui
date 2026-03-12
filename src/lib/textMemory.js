function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildMemoryMatchers(entries) {
  return [...entries]
    .filter(entry => entry.term && entry.definition)
    .sort((a, b) => b.term.length - a.term.length)
    .map(entry => ({
      ...entry,
      regex: new RegExp(`\\b${escapeRegex(entry.term)}\\b`, 'gi'),
    }));
}

export function segmentTextWithMemory(text, entries) {
  if (!text || !entries.length) {
    return [{ type: 'text', value: text || '' }];
  }

  const matches = [];
  for (const entry of buildMemoryMatchers(entries)) {
    let result;
    while ((result = entry.regex.exec(text)) !== null) {
      const start = result.index;
      const end = start + result[0].length;
      if (matches.some(match => !(end <= match.start || start >= match.end))) {
        continue;
      }
      matches.push({
        start,
        end,
        text: result[0],
        entry,
      });
    }
  }

  if (matches.length === 0) {
    return [{ type: 'text', value: text }];
  }

  matches.sort((a, b) => a.start - b.start);

  const segments = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start > cursor) {
      segments.push({ type: 'text', value: text.slice(cursor, match.start) });
    }
    segments.push({
      type: 'term',
      value: match.text,
      entry: match.entry,
    });
    cursor = match.end;
  }

  if (cursor < text.length) {
    segments.push({ type: 'text', value: text.slice(cursor) });
  }

  return segments;
}
