const BASE = '/api';

export async function fetchItems() {
  const res = await fetch(`${BASE}/items`);
  if (!res.ok) throw new Error(`Failed to fetch items: ${res.statusText}`);
  return res.json();
}

export async function fetchItem(id) {
  const res = await fetch(`${BASE}/items/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch item: ${res.statusText}`);
  return res.json();
}

export async function updateStatus(id, status) {
  const res = await fetch(`${BASE}/items/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Failed to update status: ${res.statusText}`);
  return res.json();
}

export async function fetchPageDocument(pageId) {
  const res = await fetch(`${BASE}/items/${pageId}/blocks`);
  if (!res.ok) throw new Error(`Failed to fetch page document: ${res.statusText}`);
  return res.json();
}

export async function savePageDocument(pageId, document) {
  const res = await fetch(`${BASE}/items/${pageId}/blocks`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document }),
  });
  if (!res.ok) throw new Error(`Failed to save page document: ${res.statusText}`);
  return res.json();
}

export async function fetchBlocks(pageId) {
  const document = await fetchPageDocument(pageId);
  return document.blocks || [];
}

export async function saveBlocks(pageId, blocks) {
  return savePageDocument(pageId, { blocks });
}

export async function fetchSubpageDocument(blockId) {
  const res = await fetch(`${BASE}/subpage/${blockId}/blocks`);
  if (!res.ok) throw new Error(`Failed to fetch subpage document: ${res.statusText}`);
  return res.json();
}

export async function saveSubpageDocument(blockId, document) {
  const res = await fetch(`${BASE}/subpage/${blockId}/blocks`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document }),
  });
  if (!res.ok) throw new Error(`Failed to save subpage document: ${res.statusText}`);
  return res.json();
}

export async function fetchSubpageBlocks(blockId) {
  const document = await fetchSubpageDocument(blockId);
  return document.blocks || [];
}

export async function saveSubpageBlocks(blockId, blocks) {
  return saveSubpageDocument(blockId, { blocks });
}

export async function fetchSubpageStatus(blockId) {
  const res = await fetch(`${BASE}/subpage/${blockId}/status`);
  if (!res.ok) return { status: 'idle' };
  return res.json();
}

export async function enrichContent(payload) {
  const res = await fetch(`${BASE}/enrich`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Enrich failed: ${res.statusText}`);
  }
  return res.json();
}

export async function runAgentBlock(payload) {
  const res = await fetch(`${BASE}/agent-block`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Agent call failed: ${res.statusText}`);
  }
  return data;
}
