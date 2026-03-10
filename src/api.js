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

export async function fetchBlocks(pageId) {
  const res = await fetch(`${BASE}/items/${pageId}/blocks`);
  if (!res.ok) throw new Error(`Failed to fetch blocks: ${res.statusText}`);
  return res.json();
}

export async function saveBlocks(pageId, blocks) {
  const res = await fetch(`${BASE}/items/${pageId}/blocks`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  });
  if (!res.ok) throw new Error(`Failed to save blocks: ${res.statusText}`);
  return res.json();
}

export async function fetchSubpageBlocks(blockId) {
  const res = await fetch(`${BASE}/subpage/${blockId}/blocks`);
  if (!res.ok) throw new Error(`Failed to fetch subpage blocks: ${res.statusText}`);
  return res.json();
}

export async function saveSubpageBlocks(blockId, blocks) {
  const res = await fetch(`${BASE}/subpage/${blockId}/blocks`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  });
  if (!res.ok) throw new Error(`Failed to save subpage blocks: ${res.statusText}`);
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
