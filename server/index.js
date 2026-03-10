import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Client } from '@notionhq/client';
import Groq from 'groq-sdk';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR);

const app = express();
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || origin.startsWith('http://localhost')),
}));
app.use(express.json());

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

// ---------------------------------------------------------------------------
// Notion helpers
// ---------------------------------------------------------------------------

function normalizePage(page) {
  const p = page.properties;
  return {
    id: page.id,
    title:       p['Title']?.title?.[0]?.plain_text ?? '',
    sourceUrl:   p['Source URL']?.url ?? '',
    sourceName:  p['Source Name']?.select?.name ?? '',
    sourceType:  p['Source Type']?.select?.name ?? '',
    snippet:     p['Snippet']?.rich_text?.[0]?.plain_text ?? '',
    capturedAt:  p['Captured At']?.date?.start ?? null,
    publishedAt: p['Published At']?.date?.start ?? null,
    tags:        p['Tags']?.multi_select?.map(t => t.name) ?? [],
    status:      p['Status']?.select?.name ?? 'Unread',
    feedId:      p['Feed ID']?.rich_text?.[0]?.plain_text ?? '',
    contentHash: p['Content Hash']?.rich_text?.[0]?.plain_text ?? '',
    llmSummary:  p['LLM Summary']?.rich_text?.[0]?.plain_text ?? '',
  };
}

function buildNotionProperties(args) {
  const props = {};
  if (args.title       !== undefined) props['Title']       = { title: [{ text: { content: args.title } }] };
  if (args.sourceUrl   !== undefined) props['Source URL']  = { url: args.sourceUrl || null };
  if (args.sourceName  !== undefined) props['Source Name'] = { select: { name: args.sourceName } };
  if (args.sourceType  !== undefined) props['Source Type'] = { select: { name: args.sourceType } };
  if (args.snippet     !== undefined) props['Snippet']     = { rich_text: [{ text: { content: args.snippet } }] };
  if (args.tags        !== undefined) props['Tags']        = { multi_select: args.tags.map(t => ({ name: t })) };
  if (args.status      !== undefined) props['Status']      = { select: { name: args.status } };
  if (args.llmSummary  !== undefined) props['LLM Summary'] = { rich_text: [{ text: { content: args.llmSummary } }] };
  if (args.capturedAt  !== undefined) props['Captured At'] = { date: { start: args.capturedAt } };
  if (args.publishedAt !== undefined) props['Published At']= { date: { start: args.publishedAt } };
  return props;
}

async function queryAllItems() {
  const results = [];
  let cursor;
  do {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      page_size: 100,
      start_cursor: cursor,
    });
    for (const page of response.results) results.push(normalizePage(page));
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);
  return results;
}

// ---------------------------------------------------------------------------
// Block file storage helpers
// ---------------------------------------------------------------------------

function blocksPath(pageId) {
  return join(DATA_DIR, `${pageId.replace(/-/g, '')}.json`);
}

function subpagePath(blockId) {
  return join(DATA_DIR, `sub-${blockId.replace(/-/g, '')}.json`);
}

function readJSON(filePath) {
  if (!existsSync(filePath)) return [];
  try { return JSON.parse(readFileSync(filePath, 'utf-8')); } catch { return []; }
}

function writeJSON(filePath, data) {
  writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ---------------------------------------------------------------------------
// Search helpers (Perplexity + YouTube)
// ---------------------------------------------------------------------------

async function searchWeb(query, maxResults = 5) {
  const response = await fetch('https://api.perplexity.ai/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, max_results: maxResults, max_tokens_per_page: 1024 }),
  });
  if (!response.ok) throw new Error(`Perplexity error ${response.status}`);
  const data = await response.json();
  return (data.results ?? []).map(r => ({
    title:   r.title,
    url:     r.url,
    snippet: r.snippet?.substring(0, 500),
    date:    r.date,
  }));
}

async function searchYouTube(query, maxResults = 3) {
  const params = new URLSearchParams({
    part: 'snippet', q: query, type: 'video',
    maxResults, order: 'relevance',
    key: process.env.YOUTUBE_API_KEY,
  });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  if (!response.ok) throw new Error(`YouTube error ${response.status}`);
  const data = await response.json();
  return (data.items ?? []).map(item => ({
    title:       item.snippet.title,
    description: item.snippet.description,
    videoId:     item.id.videoId,
    embedUrl:    `https://www.youtube.com/embed/${item.id.videoId}`,
    publishedAt: item.snippet.publishedAt,
  }));
}

// ---------------------------------------------------------------------------
// Groq enrichment helpers
// ---------------------------------------------------------------------------

const SEARCH_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search',
      description: 'Search the web for real articles, papers, and references. Use the returned URLs for citation blocks — never invent URLs.',
      parameters: {
        type: 'object',
        required: ['query'],
        properties: {
          query:        { type: 'string',  description: 'Search query using key terms from the content' },
          max_results:  { type: 'integer', description: 'Number of results, 1–10 (default 5)' },
          top_n:        { type: 'integer', description: 'Alias for max_results' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_youtube',
      description: 'Search YouTube for relevant videos. Only call this when a video would genuinely enrich the content. Use embedUrl from results for iframe blocks.',
      parameters: {
        type: 'object',
        required: ['query'],
        properties: {
          query:       { type: 'string',  description: 'YouTube search query' },
          max_results: { type: 'integer', description: 'Number of results, 1–5 (default 3)' },
        },
      },
    },
  },
];

function extractBlocks(text) {
  const stripped = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  const match = stripped.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON array found in LLM response');
  const blocks = JSON.parse(match[0]);
  return blocks.map(b => ({ ...b, id: b.id || randomUUID() }));
}

function buildEnrichSystemPrompt(mode, { title, snippet, tags, sourceName, existingBlocks, subpageTitle, subpageDescription, parentContext }) {
  const blockTypes = `Block types (return ONLY these fields):
- { "type": "citation", "id": "block-N", "title": "...", "url": "<URL from search>", "relevance": "1-2 sentences" }
- { "type": "iframe",   "id": "block-N", "url": "<embedUrl from search_youtube>", "title": "...", "caption": "..." }
- { "type": "subpage",  "id": "block-N", "title": "...", "description": "2-3 sentences", "generatedBlocks": null }
- { "type": "text",     "id": "block-N", "heading": "...", "body": "2-4 sentences of analysis" }`;

  const rules = `Rules:
- Call search 1–3 times to find real sources BEFORE generating citation blocks
- Call search_youtube at most once, only if a video genuinely adds value
- Citation URLs MUST come from search results — never invent them
- Iframe embedUrls MUST come from search_youtube results — never invent video IDs
- Sub-page and text blocks do NOT require search
- Mix types — always include at least 1 citation and 1 text block
- Return ONLY a valid JSON array. No markdown, no explanation.`;

  if (mode === 'subpage') {
    return `You are an AI research assistant enriching a deep-dive sub-page in Grabbit.

Parent article: ${parentContext || '(unknown)'}
Sub-page topic: ${subpageTitle}
Description: ${subpageDescription}

Search for relevant sources, then generate 4–6 enrichment blocks.

${blockTypes}

${rules}`;
  }

  const existingSummary = existingBlocks?.length
    ? `\nExisting blocks (do not duplicate):\n${existingBlocks.map(b => `  - [${b.type}] ${b.title || b.heading || b.description || '(block)'}`).join('\n')}\n`
    : '';

  const count = mode === 'more' ? '3–4 NEW, non-redundant' : '4–6';

  return `You are an AI research assistant enriching a content feed item for Grabbit.

Search for real sources, then generate ${count} enrichment blocks.
${existingSummary}
${blockTypes}

${rules}

Content item:
Title:   ${title || '(untitled)'}
Source:  ${sourceName || 'Unknown'}
Tags:    ${tags?.join(', ') || 'none'}
Snippet: ${snippet || '(no snippet)'}`;
}

async function runEnrichWithSearch(systemPrompt) {
  const messages = [{ role: 'system', content: systemPrompt }];

  for (let iter = 0; iter < 6; iter++) {
    const response = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages,
      tools: SEARCH_TOOLS,
      tool_choice: 'auto',
      temperature: 0.7,
      max_completion_tokens: 4096,
      stream: false,
    });

    const msg = response.choices[0].message;
    messages.push(msg);
    if (!msg.tool_calls?.length) return extractBlocks(msg.content);

    for (const tc of msg.tool_calls) {
      let args;
      try { args = JSON.parse(tc.function.arguments); } catch { args = {}; }

      let result;
      try {
        if (tc.function.name === 'search') {
          const n = args.max_results ?? args.top_n ?? 5;
          result = { results: await searchWeb(args.query, n) };
        } else if (tc.function.name === 'search_youtube') {
          result = { results: await searchYouTube(args.query, args.max_results) };
        } else {
          result = { error: `Unknown tool: ${tc.function.name}` };
        }
      } catch (err) {
        result = { error: err.message };
      }

      messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
    }
  }

  throw new Error('Enrichment loop did not return blocks');
}

// Kept for page-chat `enrich` tool (which doesn't use search — fast path)
function buildEnrichMorePrompt(title, snippet, tags, sourceName, existingBlocks) {
  const summary = existingBlocks
    .map(b => `  - [${b.type}] ${b.title || b.heading || b.description || '(block)'}`)
    .join('\n');
  return `Generate 3-4 new enrichment blocks for this content item. Return ONLY a JSON array.

Block types: citation {type,id,title,url,relevance}, iframe {type,id,url,title,caption}, subpage {type,id,title,description,generatedBlocks:null}, text {type,id,heading,body}

Existing blocks (do not repeat):\n${summary}

Title: ${title || ''}\nSource: ${sourceName || ''}\nTags: ${tags?.join(', ') || ''}\nSnippet: ${snippet || ''}`;
}

// ---------------------------------------------------------------------------
// LLM chat tool definitions (for /api/chat)
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'list_items',
      description: 'List all items in the Grabbit database. Returns id, title, status, sourceName, tags, capturedAt.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_item',
      description: 'Create a new item in the Grabbit Notion database.',
      parameters: {
        type: 'object',
        required: ['title'],
        properties: {
          title:       { type: 'string' },
          sourceUrl:   { type: 'string' },
          sourceName:  { type: 'string' },
          sourceType:  { type: 'string', enum: ['Grabbit workflow', 'Manual', 'API'] },
          snippet:     { type: 'string' },
          tags:        { type: 'array', items: { type: 'string' } },
          status:      { type: 'string', enum: ['Unread', 'Read', 'Starred', 'Archived'] },
          llmSummary:  { type: 'string' },
          capturedAt:  { type: 'string' },
          publishedAt: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_item',
      description: 'Update properties of an existing item. Pass only fields to change.',
      parameters: {
        type: 'object',
        required: ['id'],
        properties: {
          id:          { type: 'string' },
          title:       { type: 'string' },
          sourceUrl:   { type: 'string' },
          sourceName:  { type: 'string' },
          sourceType:  { type: 'string', enum: ['Grabbit workflow', 'Manual', 'API'] },
          snippet:     { type: 'string' },
          tags:        { type: 'array', items: { type: 'string' } },
          status:      { type: 'string', enum: ['Unread', 'Read', 'Starred', 'Archived'] },
          llmSummary:  { type: 'string' },
          capturedAt:  { type: 'string' },
          publishedAt: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_item',
      description: 'Archive/delete an item by its ID.',
      parameters: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  },
];

const TOOL_LABELS = {
  list_items:  'Reading database…',
  create_item: 'Creating item…',
  update_item: 'Updating item…',
  delete_item: 'Deleting item…',
};

async function executeTool(name, args) {
  switch (name) {
    case 'list_items': {
      const items = await queryAllItems();
      return JSON.stringify(items.map(i => ({
        id: i.id, title: i.title, status: i.status,
        sourceName: i.sourceName, tags: i.tags, capturedAt: i.capturedAt,
      })));
    }
    case 'create_item': {
      const page = await notion.pages.create({
        parent: { database_id: DATABASE_ID },
        properties: buildNotionProperties(args),
      });
      return JSON.stringify({ ok: true, id: page.id });
    }
    case 'update_item': {
      const { id, ...rest } = args;
      await notion.pages.update({ page_id: id, properties: buildNotionProperties(rest) });
      return JSON.stringify({ ok: true });
    }
    case 'delete_item': {
      await notion.pages.update({ page_id: args.id, archived: true });
      return JSON.stringify({ ok: true });
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

// ---------------------------------------------------------------------------
// REST endpoints
// ---------------------------------------------------------------------------

app.get('/api/items', async (req, res) => {
  try { res.json(await queryAllItems()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/items/:id', async (req, res) => {
  try {
    const page = await notion.pages.retrieve({ page_id: req.params.id });
    res.json(normalizePage(page));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/items/:id', async (req, res) => {
  const { status } = req.body;
  const allowed = ['Unread', 'Read', 'Starred', 'Archived'];
  if (!allowed.includes(status)) return res.status(400).json({ error: `Invalid status: ${status}` });
  try {
    await notion.pages.update({
      page_id: req.params.id,
      properties: { Status: { select: { name: status } } },
    });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Block storage ---

app.get('/api/items/:id/blocks', (req, res) => {
  res.json(readJSON(blocksPath(req.params.id)));
});

app.put('/api/items/:id/blocks', (req, res) => {
  const { blocks } = req.body;
  if (!Array.isArray(blocks)) return res.status(400).json({ error: 'blocks must be an array' });
  writeJSON(blocksPath(req.params.id), blocks);
  res.json({ ok: true });
});

app.get('/api/subpage/:blockId/blocks', (req, res) => {
  res.json(readJSON(subpagePath(req.params.blockId)));
});

app.put('/api/subpage/:blockId/blocks', (req, res) => {
  const { blocks } = req.body;
  if (!Array.isArray(blocks)) return res.status(400).json({ error: 'blocks must be an array' });
  writeJSON(subpagePath(req.params.blockId), blocks);
  res.json({ ok: true });
});

// --- Search routes (also used by agent tools internally) ---

app.post('/api/search/web', async (req, res) => {
  try {
    const results = await searchWeb(req.body.query, req.body.max_results);
    res.json({ results });
  } catch (err) {
    console.error('GET /api/search/web error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/search/youtube', async (req, res) => {
  try {
    const results = await searchYouTube(req.body.query, req.body.max_results);
    res.json({ results });
  } catch (err) {
    console.error('GET /api/search/youtube error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- AI Enrichment (with search tool loop) ---

app.post('/api/enrich', async (req, res) => {
  const { mode = 'initial', title, snippet, tags, sourceName, existingBlocks = [],
          subpageTitle, subpageDescription, parentContext } = req.body;
  try {
    const systemPrompt = buildEnrichSystemPrompt(mode, {
      title, snippet, tags, sourceName, existingBlocks,
      subpageTitle, subpageDescription, parentContext,
    });
    const blocks = await runEnrichWithSearch(systemPrompt);
    res.json({ blocks });
  } catch (err) {
    console.error('POST /api/enrich error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- LLM Chat (SSE) ---

const SYSTEM_PROMPT = `You are a helpful assistant for Grabbit, a personal content feed app backed by a Notion database.
You can read, create, update, and delete items using the provided tools.
After making changes, briefly summarize what you did. Be concise. Today is ${new Date().toISOString().split('T')[0]}.`;

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages must be an array' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    const apiMessages = [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];
    let dbMutated = false;

    for (let iter = 0; iter < 6; iter++) {
      const response = await groq.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        messages: apiMessages,
        tools: TOOLS,
        tool_choice: 'auto',
        temperature: 1,
        max_completion_tokens: 8192,
        top_p: 1,
        reasoning_effort: 'medium',
        stream: false,
      });

      const msg = response.choices[0].message;
      apiMessages.push(msg);
      if (!msg.tool_calls?.length) break;

      for (const tc of msg.tool_calls) {
        let args;
        try { args = JSON.parse(tc.function.arguments); } catch { args = {}; }
        send('action', { label: TOOL_LABELS[tc.function.name] ?? `Running ${tc.function.name}…` });
        const result = await executeTool(tc.function.name, args);
        if (['create_item', 'update_item', 'delete_item'].includes(tc.function.name)) dbMutated = true;
        apiMessages.push({ role: 'tool', tool_call_id: tc.id, content: result });
      }
    }

    const stream = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: apiMessages,
      temperature: 1,
      max_completion_tokens: 8192,
      top_p: 1,
      reasoning_effort: 'medium',
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) send('delta', { content: delta });
    }

    if (dbMutated) send('refresh', {});
    send('done', {});
  } catch (err) {
    console.error('POST /api/chat error:', err.message);
    send('error', { message: err.message });
  }

  res.end();
});

// ---------------------------------------------------------------------------
// POST /api/page-chat — canvas-aware LLM chat with block tools, SSE
// ---------------------------------------------------------------------------

const PAGE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'list_blocks',
      description: 'Get all current blocks on the canvas with their IDs, types, and a short label. Always call this before update_block or delete_block so you know the IDs.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'clear_blocks',
      description: 'Remove ALL blocks from the canvas at once. Use this when the user asks to clear, wipe, reset, or delete the entire canvas/view.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_block',
      description: 'Add a new block to the canvas. Supported types: citation, iframe, subpage, text.',
      parameters: {
        type: 'object',
        required: ['type'],
        properties: {
          type:        { type: 'string', enum: ['citation', 'iframe', 'subpage', 'text'] },
          title:       { type: 'string', description: 'Title for citation, iframe, or subpage' },
          url:         { type: 'string', description: 'URL for citation (article) or iframe (YouTube embed: https://www.youtube.com/embed/VIDEO_ID)' },
          relevance:   { type: 'string', description: 'Why this is relevant — citation only' },
          caption:     { type: 'string', description: 'Caption below iframe' },
          description: { type: 'string', description: 'Required for subpage: 2-3 sentence summary of what the sub-page covers. Do not omit.' },
          auto_prompt: { type: 'string', description: 'Required for subpage: instructions for generating the subpage content. Describe what topics, angles, and block types the subpage should contain.' },
          heading:     { type: 'string', description: 'Section heading — text only' },
          body:        { type: 'string', description: 'Body paragraph — text only' },
          position:    { type: 'integer', description: 'Index to insert at (0 = top). Omit to append at bottom.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_block',
      description: 'Update one or more fields of an existing block. Call list_blocks first to get IDs.',
      parameters: {
        type: 'object',
        required: ['id'],
        properties: {
          id:          { type: 'string' },
          title:       { type: 'string' },
          url:         { type: 'string' },
          relevance:   { type: 'string' },
          caption:     { type: 'string' },
          description: { type: 'string' },
          heading:     { type: 'string' },
          body:        { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_block',
      description: 'Remove a block from the canvas by ID. Call list_blocks first to get IDs.',
      parameters: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reorder_blocks',
      description: 'Reorder the canvas by supplying all block IDs in the desired new order.',
      parameters: {
        type: 'object',
        required: ['ids'],
        properties: {
          ids: { type: 'array', items: { type: 'string' }, description: 'Every block ID in desired order' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'enrich',
      description: 'Auto-generate new enrichment blocks (like clicking "Enrich More") and append them to the canvas.',
      parameters: {
        type: 'object',
        properties: {
          focus: { type: 'string', description: 'Optional focus, e.g. "practical applications" or "more citations"' },
        },
      },
    },
  },
  ...SEARCH_TOOLS,
];

const PAGE_TOOL_LABELS = {
  list_blocks:    'Reading canvas…',
  clear_blocks:   'Clearing canvas…',
  add_block:      'Adding block…',
  update_block:   'Updating block…',
  delete_block:   'Removing block…',
  reorder_blocks: 'Reordering blocks…',
  enrich:         'Generating enrichment…',
  search:         'Searching the web…',
  search_youtube: 'Searching YouTube…',
};

const PAGE_MUTATING = new Set(['add_block', 'update_block', 'delete_block', 'clear_blocks', 'reorder_blocks', 'enrich']);

async function executePageTool(name, args, blocks, pageContext) {
  switch (name) {
    case 'list_blocks': {
      if (blocks.length === 0) return JSON.stringify({ message: 'Canvas is empty', blocks: [] });
      return JSON.stringify(blocks.map(b => ({
        id:      b.id,
        type:    b.type,
        label:   b.title || b.heading || b.description || '(no label)',
        preview: (b.relevance || b.body || b.caption || '').slice(0, 100),
      })));
    }

    case 'clear_blocks': {
      const count = blocks.length;
      blocks.length = 0;
      return JSON.stringify({ ok: true, removed: count });
    }

    case 'add_block': {
      const { position, auto_prompt, ...fields } = args;
      const block = { ...fields, id: randomUUID() };
      if (typeof position === 'number' && position >= 0 && position <= blocks.length) {
        blocks.splice(position, 0, block);
      } else {
        blocks.push(block);
      }

      // Background subpage enrichment — fire and forget
      if (block.type === 'subpage' && auto_prompt) {
        const subpageSystemPrompt = buildEnrichSystemPrompt('subpage', {
          subpageTitle:       block.title || '',
          subpageDescription: block.description || '',
          parentContext:      pageContext.title || '',
        }) + `\n\nAdditional instructions: ${auto_prompt}`;

        runEnrichWithSearch(subpageSystemPrompt)
          .then(generatedBlocks => writeJSON(subpagePath(block.id), generatedBlocks))
          .catch(err => console.error(`Background subpage enrich failed for ${block.id}:`, err.message));
      }

      return JSON.stringify({ ok: true, id: block.id });
    }

    case 'update_block': {
      const { id, ...changes } = args;
      const idx = blocks.findIndex(b => b.id === id);
      if (idx === -1) return JSON.stringify({ error: `Block "${id}" not found. Call list_blocks to see valid IDs.` });
      blocks[idx] = { ...blocks[idx], ...changes };
      return JSON.stringify({ ok: true });
    }

    case 'delete_block': {
      const idx = blocks.findIndex(b => b.id === args.id);
      if (idx === -1) return JSON.stringify({ error: `Block "${args.id}" not found. Call list_blocks to see valid IDs.` });
      blocks.splice(idx, 1);
      return JSON.stringify({ ok: true });
    }

    case 'reorder_blocks': {
      const map = new Map(blocks.map(b => [b.id, b]));
      const ordered = args.ids.map(id => map.get(id)).filter(Boolean);
      const included = new Set(args.ids);
      const rest = blocks.filter(b => !included.has(b.id));
      blocks.length = 0;
      blocks.push(...ordered, ...rest);
      return JSON.stringify({ ok: true });
    }

    case 'enrich': {
      let prompt = buildEnrichMorePrompt(
        pageContext.title, pageContext.snippet,
        pageContext.tags,  pageContext.sourceName, blocks,
      );
      if (args.focus) prompt += `\n\nFocus on: ${args.focus}`;
      const response = await groq.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_completion_tokens: 4096,
        stream: false,
      });
      const newBlocks = extractBlocks(response.choices[0].message.content);
      blocks.push(...newBlocks);
      return JSON.stringify({ ok: true, added: newBlocks.length });
    }

    case 'search': {
      const n = args.max_results ?? args.top_n ?? 5;
      const results = await searchWeb(args.query, n);
      return JSON.stringify({ results });
    }

    case 'search_youtube': {
      const results = await searchYouTube(args.query, args.max_results);
      return JSON.stringify({ results });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

app.post('/api/page-chat', async (req, res) => {
  const { messages, blocks: clientBlocks = [], pageContext = {} } = req.body;
  if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  // Mutable working copy — mutations are broadcast via SSE, client saves to disk
  const blocks = clientBlocks.map(b => ({ ...b }));

  try {
    const systemPrompt = `You are an AI assistant managing the enrichment canvas for a Grabbit content page.

Use tools to add, edit, delete, reorder, or generate blocks. Always call list_blocks before referencing blocks by ID.

Block types you can add:
- citation  { type, title, url, relevance }
- iframe    { type, url, title, caption }  — YouTube embed URLs only
- subpage   { type, title, description, auto_prompt }   — opens a deep-dive page; description and auto_prompt are REQUIRED — never omit them
- text      { type, heading, body }        — written analysis

Current page:
Title:   ${pageContext.title    || '(untitled)'}
Source:  ${pageContext.sourceName || 'unknown'}
Tags:    ${pageContext.tags?.join(', ') || 'none'}
Snippet: ${pageContext.snippet  || '(none)'}
Canvas:  ${blocks.length} block(s) — call list_blocks to inspect them.

Be concise. After making changes, briefly confirm what you did.`;

    const apiMessages = [{ role: 'system', content: systemPrompt }, ...messages];

    for (let iter = 0; iter < 8; iter++) {
      const response = await groq.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        messages: apiMessages,
        tools: PAGE_TOOLS,
        tool_choice: 'auto',
        temperature: 0.5,
        max_completion_tokens: 4096,
        stream: false,
      });

      const msg = response.choices[0].message;
      apiMessages.push(msg);
      if (!msg.tool_calls?.length) break;

      for (const tc of msg.tool_calls) {
        let args;
        try { args = JSON.parse(tc.function.arguments); } catch { args = {}; }

        send('action', { label: PAGE_TOOL_LABELS[tc.function.name] ?? `Running ${tc.function.name}…` });

        const result = await executePageTool(tc.function.name, args, blocks, pageContext);

        if (PAGE_MUTATING.has(tc.function.name)) {
          send('blocks', { blocks: [...blocks] });
        }

        apiMessages.push({ role: 'tool', tool_call_id: tc.id, content: result });
      }
    }

    // Stream the final response — no tools param to avoid tool_choice conflicts
    const stream = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: apiMessages,
      temperature: 0.5,
      max_completion_tokens: 1024,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) send('delta', { content: delta });
    }

    send('done', {});
  } catch (err) {
    console.error('POST /api/page-chat error:', err.message);
    send('error', { message: err.message });
  }

  res.end();
});

// ---------------------------------------------------------------------------

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(`Grabbit API on http://localhost:${PORT}`));
