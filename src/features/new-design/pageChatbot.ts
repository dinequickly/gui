import OpenAI from 'openai';
import type { Block, BlockType, PageCitation } from '../../shared/types';
import { nanoid } from '../../shared/utils/nanoid';

export type PageChatRole = 'user' | 'assistant';

export interface PageChatMessage {
  role: PageChatRole;
  content: string;
}

export interface PageAgentContext {
  fileId: string;
  title: string;
  author: string;
  blocks: Block[];
  citations: PageCitation[];
}

export interface PageAgentEdit {
  title?: string;
  author?: string;
  blocks?: Block[];
  citations?: PageCitation[];
}

const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const perplexityApiKey = import.meta.env.VITE_PERPLEXITY_API_KEY as string | undefined;
const GEMINI_MODEL = 'gemini-3-flash-preview';
const GEMINI_OPENAI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';

const client = geminiApiKey
  ? new OpenAI({
    apiKey: geminiApiKey,
    baseURL: GEMINI_OPENAI_BASE_URL,
    dangerouslyAllowBrowser: true,
  })
  : null;

interface PerplexitySearchResult {
  title: string;
  url: string;
  snippet: string;
  date?: string;
}

function serializeBlocks(blocks: Block[]) {
  return blocks.map((block, index) => {
    if (block.type === 'divider') {
      return { index, id: block.id, type: block.type };
    }
    if (block.type === 'todo') {
      return { index, id: block.id, type: block.type, text: block.text, checked: block.checked };
    }
    if (block.type === 'toggle') {
      return { index, id: block.id, type: block.type, text: block.text, open: block.open };
    }
    if (block.type === 'callout') {
      return { index, id: block.id, type: block.type, text: block.text, icon: block.icon, color: block.color };
    }
    if (block.type === 'image') {
      return { index, id: block.id, type: block.type, url: block.url, caption: block.caption ?? '' };
    }
    if (block.type === 'database_embed') {
      return { index, id: block.id, type: block.type, databaseFileId: block.databaseFileId };
    }
    return { index, id: block.id, type: block.type, text: block.text };
  });
}

function serializeCitations(citations: PageCitation[]) {
  return citations.map((citation, index) => ({
    index,
    id: citation.id,
    source: citation.source,
    title: citation.title,
    url: citation.url ?? '',
  }));
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function parseBlockType(value: unknown): BlockType | null {
  if (typeof value !== 'string') return null;
  const valid: BlockType[] = [
    'title',
    'heading1',
    'heading2',
    'heading3',
    'paragraph',
    'todo',
    'bullet',
    'numbered',
    'toggle',
    'quote',
    'divider',
    'callout',
    'image',
    'database_embed',
  ];
  return valid.includes(value as BlockType) ? (value as BlockType) : null;
}

function normalizeBlock(raw: unknown): Block | null {
  if (!raw || typeof raw !== 'object') return null;

  const input = raw as Record<string, unknown>;
  const type = parseBlockType(input.type);
  if (!type) return null;

  const id = asString(input.id).trim() || nanoid();

  if (type === 'divider') return { id, type };

  if (type === 'todo') {
    return {
      id,
      type,
      text: asString(input.text),
      checked: asBoolean(input.checked),
    };
  }

  if (type === 'toggle') {
    return {
      id,
      type,
      text: asString(input.text),
      open: asBoolean(input.open),
      children: [],
    };
  }

  if (type === 'callout') {
    return {
      id,
      type,
      text: asString(input.text),
      icon: asString(input.icon, '💡'),
      color: asString(input.color, '#fef9c3'),
    };
  }

  if (type === 'image') {
    return {
      id,
      type,
      url: asString(input.url),
      caption: asString(input.caption),
    };
  }

  if (type === 'database_embed') {
    return {
      id,
      type,
      databaseFileId: asString(input.databaseFileId),
    };
  }

  return {
    id,
    type,
    text: asString(input.text),
  };
}

function normalizeBlocks(value: unknown): Block[] {
  if (!Array.isArray(value)) return [];
  const next = value.map(normalizeBlock).filter(Boolean) as Block[];
  if (next.length > 0) return next;
  return [{ id: nanoid(), type: 'paragraph', text: '' }];
}

function normalizeCitations(value: unknown): PageCitation[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Record<string, unknown>;
      const title = asString(raw.title).trim();
      const source = asString(raw.source).trim();
      const url = asString(raw.url).trim();
      if (!title && !source && !url) return null;
      return {
        id: asString(raw.id).trim() || nanoid(),
        title,
        source,
        url,
      } satisfies PageCitation;
    })
    .filter(Boolean) as PageCitation[];
}

async function searchWebWithPerplexity(query: string, maxResults = 5): Promise<PerplexitySearchResult[]> {
  if (!perplexityApiKey) {
    throw new Error('Missing VITE_PERPLEXITY_API_KEY. Add it to your environment to enable web search.');
  }

  const clampedMaxResults = Math.max(1, Math.min(10, Math.floor(maxResults || 5)));
  const response = await fetch('https://api.perplexity.ai/search', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${perplexityApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      max_results: clampedMaxResults,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Perplexity search failed (${response.status}): ${body || response.statusText}`);
  }

  const data = await response.json() as { results?: Array<Record<string, unknown>> };
  const rawResults = Array.isArray(data.results) ? data.results : [];
  return rawResults
    .map((result) => ({
      title: asString(result.title).trim(),
      url: asString(result.url).trim(),
      snippet: asString(result.snippet).trim(),
      date: asString(result.date).trim() || undefined,
    }))
    .filter((result) => result.title || result.url || result.snippet);
}

export async function streamPageChatReply(
  messages: PageChatMessage[],
  context: PageAgentContext,
  onApplyEdit: (edit: PageAgentEdit) => Promise<void>,
  onToken: (token: string) => void,
): Promise<void> {
  if (!client) {
    throw new Error('Missing VITE_GEMINI_API_KEY. Add it to your environment to use chatbot.');
  }

  if (messages.length === 0 || messages[messages.length - 1]?.role !== 'user') {
    throw new Error('Last message must be a user message.');
  }

  const lastUserMessage = messages[messages.length - 1].content;
  const priorMessages = messages.slice(0, -1).map((message) => ({
    role: message.role,
    content: message.content,
  }));

  const systemPrompt = [
    'You are a page editing copilot.',
    'You can inspect the current page context and edit it via tools.',
    'When the user asks for external facts, recent info, or citations, use search_web.',
    'When user asks to change content, title, author, tone, structure, or rewrite text, call Edit_Page_Document.',
    'Prefer making direct, complete edits in one tool call.',
    'When updating blocks, provide the full desired blocks array in reading order.',
    'For rich text, use block types (heading1/2/3, bullet, numbered, quote, callout) instead of raw markdown-only documents.',
    'Inline emphasis supports **bold**, *italic*, _italic_, and `code` in text fields.',
    'For inline citations in text, append markers like [^cite-1] and ensure citations[] includes matching id values (e.g., cite-1).',
    'Preserve user intent and formatting, including poem/newline style where relevant.',
    'When creating citations from search, include source title and URL.',
    'After tool use, summarize what changed.',
    'Keep responses concise and practical.',
  ].join(' ');

  const payload = {
    user_message: lastUserMessage,
    page_context: {
      fileId: context.fileId,
      title: context.title,
      author: context.author,
      blocks: serializeBlocks(context.blocks),
      citations: serializeCitations(context.citations),
    },
  };

  const toolDefinitions = [
    {
      type: 'function',
      function: {
        name: 'search_web',
        description:
          'Search the web for supporting sources and recent information. Returns ranked citation-style results with title/url/snippet/date.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            max_results: { type: 'number' },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'Edit_Page_Document',
        description:
          'Edit page title, author, and/or block content. For content rewrites, provide a full blocks array with block objects.',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            author: { type: 'string' },
            blocks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  type: {
                    type: 'string',
                    enum: [
                      'title',
                      'heading1',
                      'heading2',
                      'heading3',
                      'paragraph',
                      'todo',
                      'bullet',
                      'numbered',
                      'toggle',
                      'quote',
                      'divider',
                      'callout',
                      'image',
                      'database_embed',
                    ],
                  },
                  text: { type: 'string' },
                  checked: { type: 'boolean' },
                  open: { type: 'boolean' },
                  icon: { type: 'string' },
                  color: { type: 'string' },
                  url: { type: 'string' },
                  caption: { type: 'string' },
                  databaseFileId: { type: 'string' },
                },
                required: ['type'],
              },
            },
            citations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  source: { type: 'string' },
                  title: { type: 'string' },
                  url: { type: 'string' },
                },
                required: ['title'],
              },
            },
          },
        },
      },
    },
  ];

  const baseMessages: Array<Record<string, unknown>> = [
    { role: 'system', content: systemPrompt },
    ...priorMessages,
    { role: 'user', content: JSON.stringify(payload, null, 2) },
  ];
  const conversationMessages: Array<Record<string, unknown>> = [...baseMessages];
  let hasAppliedEdit = false;

  for (let step = 0; step < 6; step += 1) {
    const response = await client.chat.completions.create({
      model: GEMINI_MODEL,
      messages: conversationMessages as never,
      tools: toolDefinitions as never,
      tool_choice: 'auto',
      temperature: 1,
      max_completion_tokens: 8192,
      top_p: 1,
      reasoning_effort: 'medium',
      stream: false,
    });

    const message = response.choices?.[0]?.message;
    const toolCalls = message?.tool_calls ?? [];

    if (toolCalls.length === 0) {
      const content = (message?.content ?? '').trim();
      if (content) onToken(content);
      else if (hasAppliedEdit) onToken('Done. I applied the requested changes.');
      return;
    }

    conversationMessages.push({
      role: 'assistant',
      content: message?.content ?? '',
      tool_calls: toolCalls,
    });

    const toolResults: Array<{ tool_call_id: string; name: string; content: string }> = [];

    for (const call of toolCalls) {
      if (call.type !== 'function') {
        continue;
      }
      const functionName = call.function?.name ?? '';
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = JSON.parse(call.function?.arguments ?? '{}') as Record<string, unknown>;
      } catch {
        parsedArgs = {};
      }

      if (functionName === 'search_web') {
        try {
          const query = asString(parsedArgs.query).trim();
          if (!query) throw new Error('search_web requires a non-empty query.');
          const maxResults = Number(parsedArgs.max_results ?? 5);
          const results = await searchWebWithPerplexity(query, Number.isFinite(maxResults) ? maxResults : 5);
          toolResults.push({
            tool_call_id: call.id,
            name: functionName,
            content: JSON.stringify({ ok: true, query, results }),
          });
        } catch (error) {
          const messageText = error instanceof Error ? error.message : 'Web search failed.';
          toolResults.push({
            tool_call_id: call.id,
            name: functionName,
            content: JSON.stringify({ ok: false, error: messageText }),
          });
        }
        continue;
      }

      if (functionName === 'Edit_Page_Document') {
        try {
          const edit: PageAgentEdit = {};
          if (typeof parsedArgs.title === 'string') edit.title = parsedArgs.title;
          if (typeof parsedArgs.author === 'string') edit.author = parsedArgs.author;
          if (Array.isArray(parsedArgs.blocks)) edit.blocks = normalizeBlocks(parsedArgs.blocks);
          if (Array.isArray(parsedArgs.citations)) edit.citations = normalizeCitations(parsedArgs.citations);

          if (!edit.title && !edit.author && !edit.blocks && !edit.citations) {
            throw new Error('No valid edits provided.');
          }

          await onApplyEdit(edit);
          hasAppliedEdit = true;
          toolResults.push({
            tool_call_id: call.id,
            name: functionName,
            content: JSON.stringify({ ok: true, applied: { title: !!edit.title, author: !!edit.author, blocks: !!edit.blocks, citations: !!edit.citations } }),
          });
        } catch (error) {
          const messageText = error instanceof Error ? error.message : 'Failed to apply document edit.';
          toolResults.push({
            tool_call_id: call.id,
            name: functionName,
            content: JSON.stringify({ ok: false, error: messageText }),
          });
        }
      }
    }

    conversationMessages.push(
      ...toolResults.map((result) => ({
        role: 'tool' as const,
        tool_call_id: result.tool_call_id,
        name: result.name,
        content: result.content,
      })),
    );
  }

  if (hasAppliedEdit) {
    onToken('Done. I applied the requested changes.');
    return;
  }

  throw new Error('Agent hit tool-call limit before finishing. Try a simpler request.');
}
