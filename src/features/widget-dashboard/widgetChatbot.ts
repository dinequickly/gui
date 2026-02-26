import { Groq } from 'groq-sdk';
import { nanoid } from '../../shared/utils/nanoid';
import type { Block, PageCitation } from '../../shared/types';
import { updatePageDocument, useFileStore } from '../../shared/store/fileStore';
import type {
  WidgetBoardStateItem,
  WidgetIframeTarget,
  WidgetPageTarget,
  WidgetToolContext,
} from './boardState';
import { publishWidgetAgentEvent } from './agentToolEvents';
import {
  applyEditPageOperation,
  DEFAULT_DASHBOARD_KEY,
  renameDashboardView,
  upsertGeneratedAgentComponents,
  type GeneratedAgentComponent,
} from './supabaseComponents';
import { slugifyView } from './viewRoutes';

export type WidgetChatRole = 'user' | 'assistant';

export interface WidgetChatMessage {
  role: WidgetChatRole;
  content: string;
}

const groqApiKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
const youtubeApiKey = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;

const client = groqApiKey
  ? new Groq({
    apiKey: groqApiKey,
    dangerouslyAllowBrowser: true,
  })
  : null;

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function toTitleCase(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

function titleFromIntent(intent: string, preferredName?: string): string {
  const cleanPreferred = (preferredName ?? '').trim();
  if (cleanPreferred) return cleanPreferred;
  const cleanIntent = intent.trim();
  if (!cleanIntent) return 'Untitled View';
  const normalized = cleanIntent.length > 72 ? `${cleanIntent.slice(0, 69)}...` : cleanIntent;
  return toTitleCase(normalized);
}

function slugFromIntent(intent: string, preferredName?: string): string {
  return slugifyView(preferredName ?? intent);
}

type DispatchJob = {
  id: string;
  agent: 'researcher' | 'youtube_related' | 'writer' | 'page_builder' | 'data_fetcher';
  instructions: string;
  depends_on?: string[];
};

function resolveDispatchAgent(agent: DispatchJob['agent']): DispatchJob['agent'] {
  return agent;
}

type PerplexitySearchResult = {
  title: string;
  url: string;
  snippet?: string;
  date?: string;
  last_updated?: string;
};

type ResearchJobResult = {
  id: string;
  instructions: string;
  results: PerplexitySearchResult[];
  text: string;
};

type DispatchResearchResult = {
  text: string;
  completedResearch: ResearchJobResult[];
};

type GeneratedCardDraft = {
  title: string;
  subtitle?: string;
  body: string;
};

type CitationEntry = {
  title: string;
  url: string;
  source?: string;
  iconUrl?: string;
};

function toYouTubeEmbedUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    let videoId = '';
    if (host.includes('youtu.be')) {
      videoId = parsed.pathname.replace('/', '').trim();
    } else if (host.includes('youtube.com')) {
      if (parsed.pathname === '/watch') {
        videoId = parsed.searchParams.get('v')?.trim() ?? '';
      } else if (parsed.pathname.startsWith('/shorts/')) {
        videoId = parsed.pathname.split('/').filter(Boolean)[1] ?? '';
      } else if (parsed.pathname.startsWith('/embed/')) {
        videoId = parsed.pathname.split('/').filter(Boolean)[1] ?? '';
      }
    }
    if (!videoId) return '';
    return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`;
  } catch {
    return '';
  }
}

function sanitizeJsonText(value: string): string {
  return value
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

function parseGeneratedCardDraft(raw: string): GeneratedCardDraft {
  const parsed = JSON.parse(sanitizeJsonText(raw)) as Record<string, unknown>;
  const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
  const subtitle = typeof parsed.subtitle === 'string' ? parsed.subtitle.trim() : '';
  const body = typeof parsed.body === 'string' ? parsed.body.trim() : '';
  if (!title || !body) throw new Error('Subagent JSON must include title and body.');
  return applyArticleHeadingCaps({ title, subtitle, body });
}

function buildResearchContext(results: ResearchJobResult[]): string {
  const lines: string[] = [];
  for (const job of results) {
    lines.push(`Job ${job.id}: ${job.instructions}`);
    for (const item of job.results) {
      lines.push(`- ${item.title}: ${item.url}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function extractUniqueSourceUrls(results: ResearchJobResult[]): string[] {
  const urls = new Set<string>();
  for (const job of results) {
    for (const item of job.results) {
      if (!item.url) continue;
      urls.add(item.url.trim());
    }
  }
  return Array.from(urls);
}

function extractUrlsFromText(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)]+/g) ?? [];
  const unique = new Set<string>();
  for (const match of matches) {
    unique.add(match.trim().replace(/[.,;]+$/, ''));
  }
  return Array.from(unique);
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function buildCitationEntries(results: ResearchJobResult[], max = 10): CitationEntry[] {
  const deduped = new Map<string, CitationEntry>();
  for (const job of results) {
    for (const item of job.results) {
      const url = (item.url ?? '').trim();
      if (!url || deduped.has(url)) continue;
      deduped.set(url, {
        title: (item.title ?? 'Source').trim() || 'Source',
        url,
        source: hostFromUrl(url) || undefined,
        iconUrl: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostFromUrl(url) || url)}&sz=128`,
      });
      if (deduped.size >= max) return Array.from(deduped.values());
    }
  }
  return Array.from(deduped.values());
}

function inferCitationContextLabel(entry: CitationEntry): string {
  const title = entry.title.toLowerCase();
  if (title.includes('transcript')) return 'Read the Transcript';
  if (title.includes('earnings call') || title.includes('earnings')) return 'Earnings Call Coverage';
  if (title.includes('investor')) return 'Investor Relations';
  if (title.includes('analysis') || title.includes('deep dive')) return 'Analysis Article';
  if (title.includes('news')) return 'News Coverage';
  if (title.includes('report')) return 'Company Report';
  return 'Introduction Article';
}

function truncateWords(input: string, maxWords: number): string {
  const words = input.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return `${words.slice(0, maxWords).join(' ')}…`;
}

function capWords(input: string, maxWords: number): string {
  const words = input.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(' ');
}

function applyArticleHeadingCaps(draft: GeneratedCardDraft): GeneratedCardDraft {
  return {
    ...draft,
    title: capWords(draft.title, 4),
    subtitle: capWords(draft.subtitle ?? '', 6),
  };
}

async function buildContextualCitationLabels(
  model: string,
  intent: string,
  entries: CitationEntry[],
): Promise<Record<string, string>> {
  if (!client || entries.length === 0) return {};
  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You label research sources by contextual purpose. Return ONLY JSON object: {"labels":[{"url":"...","label":"..."}]}. Keep labels short, human, and specific.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            intent,
            sources: entries.map((entry) => ({ url: entry.url, title: entry.title })),
            examples: ['Read the Transcript', 'Meta IR Press Release', 'Analyst Recap', 'Introduction Article'],
          }),
        },
      ],
      temperature: 0.3,
      max_completion_tokens: 1000,
      top_p: 1,
      reasoning_effort: 'medium',
      stream: false,
    });
    const raw = completion.choices?.[0]?.message?.content ?? '';
    if (!raw.trim()) return {};
    const parsed = JSON.parse(sanitizeJsonText(raw)) as { labels?: Array<{ url?: string; label?: string }> };
    const map: Record<string, string> = {};
    for (const entry of parsed.labels ?? []) {
      const url = (entry.url ?? '').trim();
      const label = (entry.label ?? '').trim();
      if (!url || !label) continue;
      map[url] = label;
    }
    return map;
  } catch {
    return {};
  }
}

async function createInternalPageFromDraft(
  draft: GeneratedCardDraft,
  fallbackUrls: string[],
): Promise<string> {
  const createPage = useFileStore.getState().createPage;
  const fileId = await createPage(draft.title || 'Untitled article', 'Widget Agent');

  const bodyUrls = extractUrlsFromText(draft.body);
  const urls = Array.from(new Set([...bodyUrls, ...fallbackUrls])).slice(0, 12);
  const citations: PageCitation[] = urls.map((url, index) => ({
    id: `cite-${index + 1}`,
    source: hostFromUrl(url) || 'Source',
    title: hostFromUrl(url) ? `Reference from ${hostFromUrl(url)}` : `Reference ${index + 1}`,
    url,
  }));

  const blocks: Block[] = [
    { id: nanoid(), type: 'paragraph', text: draft.body || 'No content yet.' },
  ];

  await updatePageDocument(fileId, { blocks, citations });

  return fileId;
}

async function runCardSubagent(
  model: string,
  system: string,
  userPrompt: string,
  fallback: GeneratedCardDraft,
): Promise<GeneratedCardDraft> {
  if (!client) return applyArticleHeadingCaps(fallback);
  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      max_completion_tokens: 10000,
      top_p: 1,
      reasoning_effort: 'medium',
      stream: false,
    });
    const raw = completion.choices?.[0]?.message?.content ?? '';
    if (!raw.trim()) return applyArticleHeadingCaps(fallback);
    return parseGeneratedCardDraft(raw);
  } catch {
    return applyArticleHeadingCaps(fallback);
  }
}

async function buildGeneratedComponentsFromResearch(
  model: string,
  intent: string,
  results: ResearchJobResult[],
): Promise<GeneratedAgentComponent[]> {
  const context = buildResearchContext(results);
  const sourceUrls = extractUniqueSourceUrls(results);
  const citationEntries = buildCitationEntries(results, 10);

  const [cardA, cardB] = await Promise.all([
    runCardSubagent(
      model,
      'You create one dashboard content card. Return ONLY JSON: {"title":"...","subtitle":"...","body":"..."}. Title must be at most 4 words. Subtitle must be at most 6 words.',
      `User intent: ${intent}\n\nResearch:\n${context}\n\nCreate a concise executive summary card.`,
      {
        title: 'Executive Summary',
        subtitle: 'Key Takeaways',
        body: 'Highlights generated from current research results.',
      },
    ),
    runCardSubagent(
      model,
      'You create one dashboard content card. Return ONLY JSON: {"title":"...","subtitle":"...","body":"..."}. Title must be at most 4 words. Subtitle must be at most 6 words.',
      `User intent: ${intent}\n\nResearch:\n${context}\n\nCreate a second card focused on details, metrics, and notable commentary.`,
      {
        title: 'Details',
        subtitle: 'Metrics and Commentary',
        body: 'Detailed notes generated from current research results.',
      },
    ),
  ]);

  const [cardAFileId, cardBFileId] = await Promise.all([
    createInternalPageFromDraft(cardA, sourceUrls),
    createInternalPageFromDraft(cardB, sourceUrls),
  ]);
  const youtubeEntries = citationEntries
    .map((entry) => ({ entry, embedUrl: toYouTubeEmbedUrl(entry.url) }))
    .filter((item) => Boolean(item.embedUrl))
    .slice(0, 6);

  const youtubeUrls = new Set(youtubeEntries.map((item) => item.entry.url));
  const nonYoutubeEntries = citationEntries.filter((entry) => !youtubeUrls.has(entry.url));

  const contextualLabels = await buildContextualCitationLabels(model, intent, nonYoutubeEntries);

  function placeInFourColumns(index: number, startOrder = 2): { column: 1 | 2 | 3 | 4; order: number } {
    return {
      column: ((index % 4) + 1) as 1 | 2 | 3 | 4,
      order: startOrder + Math.floor(index / 4),
    };
  }

  const videoCards: GeneratedAgentComponent[] = youtubeEntries.map(({ entry, embedUrl }, index) => {
    const placement = placeInFourColumns(index, 2);
    return {
      slot: `agent-video-${index + 1}`,
      component_type: 'videoCard',
      title: truncateWords(entry.title, 5),
      body: '',
      label: 'Open in theater mode',
      embedUrl,
      column: placement.column,
      order: placement.order,
      width: 500,
      height: 320,
    };
  });

  const citationCards: GeneratedAgentComponent[] = nonYoutubeEntries.map((entry, index) => {
    const placement = placeInFourColumns(videoCards.length + index, 2);
    return {
      slot: `agent-source-${index + 1}`,
      component_type: 'sourceLinkCard',
      title: contextualLabels[entry.url] || inferCitationContextLabel(entry),
      subtitle: '',
      body: '',
      source: entry.source ?? hostFromUrl(entry.url),
      linkUrl: entry.url,
      iconUrl: entry.iconUrl,
      cta: 'Open Link',
      column: placement.column,
      order: placement.order,
      width: 500,
      height: 180,
    };
  });

  return [
    {
      slot: 'agent-page-1',
      component_type: 'readerCard',
      title: cardA.title,
      subtitle: cardA.subtitle,
      body: cardA.body,
      fileId: cardAFileId,
      cta: 'Open Page',
      column: 1,
      order: 1,
      width: 500,
      height: 420,
    },
    {
      slot: 'agent-page-2',
      component_type: 'readerCard',
      title: cardB.title,
      subtitle: cardB.subtitle,
      body: cardB.body,
      fileId: cardBFileId,
      cta: 'Open Page',
      column: 2,
      order: 1,
      width: 500,
      height: 420,
    },
    ...videoCards,
    ...citationCards,
  ];
}

async function runPerplexityResearchJob(job: DispatchJob): Promise<ResearchJobResult> {
  const response = await fetch('/api/perplexity/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: job.instructions,
      max_results: 10,
      max_tokens: 25000,
      max_tokens_per_page: 2048,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Perplexity request failed (${response.status}): ${errorText}`);
  }

  const payload = await response.json() as { results?: PerplexitySearchResult[] };
  const results = payload.results ?? [];
  if (results.length === 0) {
    return {
      id: job.id,
      instructions: job.instructions,
      results: [],
      text: `[${job.id}] No results found.`,
    };
  }

  const lines = results.map((result, index) => {
    const title = result.title || 'Untitled';
    const url = result.url || '';
    return `${index + 1}. ${title}: ${url}`;
  });

  return {
    id: job.id,
    instructions: job.instructions,
    results,
    text: `[${job.id}] ${job.instructions}\n${lines.join('\n')}`,
  };
}

async function runYouTubeRelatedResearchJob(job: DispatchJob): Promise<ResearchJobResult> {
  if (!youtubeApiKey) {
    throw new Error('Missing VITE_YOUTUBE_API_KEY for youtube_related jobs.');
  }

  const params = new URLSearchParams({
    q: job.instructions,
    type: 'video',
    part: 'snippet',
    order: 'relevance',
    maxResults: '10',
    key: youtubeApiKey,
  });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`YouTube request failed (${response.status}): ${errorText}`);
  }

  const payload = await response.json() as {
    items?: Array<{
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        description?: string;
        channelTitle?: string;
        publishedAt?: string;
      };
    }>;
  };

  const results: PerplexitySearchResult[] = (payload.items ?? [])
    .map((item) => {
      const videoId = item.id?.videoId?.trim();
      if (!videoId) return null;
      const title = item.snippet?.title?.trim() || 'Untitled';
      const description = item.snippet?.description?.trim() || '';
      const channel = item.snippet?.channelTitle?.trim();
      const snippet = channel ? `${channel}${description ? ` — ${description}` : ''}` : description;
      return {
        title,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        snippet,
        date: item.snippet?.publishedAt,
      } satisfies PerplexitySearchResult;
    })
    .filter(Boolean) as PerplexitySearchResult[];

  if (results.length === 0) {
    return {
      id: job.id,
      instructions: job.instructions,
      results: [],
      text: `[${job.id}] No YouTube results found.`,
    };
  }

  const lines = results.map((result, index) => {
    const title = result.title || 'Untitled';
    const url = result.url || '';
    return `${index + 1}. ${title}: ${url}`;
  });

  return {
    id: job.id,
    instructions: job.instructions,
    results,
    text: `[${job.id}] ${job.instructions}\n${lines.join('\n')}`,
  };
}

async function runDispatchResearchJobs(jobs: DispatchJob[]): Promise<DispatchResearchResult> {
  const supported = jobs.filter((job) => {
    const resolvedAgent = resolveDispatchAgent(job.agent);
    return resolvedAgent === 'youtube_related' || resolvedAgent === 'researcher';
  });
  const unsupported = jobs.filter((job) => {
    const resolvedAgent = resolveDispatchAgent(job.agent);
    return resolvedAgent !== 'youtube_related' && resolvedAgent !== 'researcher';
  });

  const outputs = await Promise.all(supported.map(async (job) => {
    const resolvedAgent = resolveDispatchAgent(job.agent);
    try {
      if (resolvedAgent === 'youtube_related') {
        return await runYouTubeRelatedResearchJob(job);
      }
      if (resolvedAgent === 'researcher') {
        return await runPerplexityResearchJob(job);
      }
      return {
        id: job.id,
        instructions: job.instructions,
        results: [],
        text: `[${job.id}] SKIPPED: agent "${job.agent}" is not implemented yet.`,
      } satisfies ResearchJobResult;
    } catch (error) {
      const defaultMessage = resolvedAgent === 'youtube_related'
        ? 'Unknown YouTube researcher error.'
        : 'Unknown researcher error.';
      const message = error instanceof Error ? error.message : defaultMessage;
      return {
        id: job.id,
        instructions: job.instructions,
        results: [],
        text: `[${job.id}] ERROR: ${message}`,
      } satisfies ResearchJobResult;
    }
  }));

  const unsupportedLines = unsupported.map(
    (job) => `[${job.id}] SKIPPED: agent "${job.agent}" is not implemented yet.`,
  );

  return {
    text: [...outputs.map((item) => item.text), ...unsupportedLines].join('\n\n'),
    completedResearch: outputs.filter((item) => item.results.length > 0),
  };
}

function pickIframeTarget(
  args: { iframe_id?: string; embedUrl?: string; title?: string },
  context: WidgetToolContext,
): WidgetIframeTarget | null {
  const iframeId = normalizeText(args.iframe_id ?? '');
  const embedUrl = normalizeText(args.embedUrl ?? '');
  const title = normalizeText(args.title ?? '');

  if (embedUrl) {
    const byUrl = context.iframes.find((item) => normalizeText(item.embedUrl) === embedUrl);
    if (byUrl) return byUrl;
  }

  if (iframeId) {
    const byId = context.iframes.find((item) => normalizeText(item.widget_uuid) === iframeId);
    if (byId) return byId;
  }

  if (title) {
    const byTitle = context.iframes.find((item) => normalizeText(item.widget_title).includes(title));
    if (byTitle) return byTitle;
  }

  return context.iframes[0] ?? null;
}

function pickPageTarget(
  args: { url?: string; slug?: string; title?: string },
  context: WidgetToolContext,
): WidgetPageTarget | null {
  const url = normalizeText(args.url ?? '');
  const slug = normalizeText(args.slug ?? '');
  const title = normalizeText(args.title ?? '');

  if (url) {
    const byUrl = context.pages.find((item) => normalizeText(item.url) === url);
    if (byUrl) return byUrl;
  }

  if (slug) {
    const bySlug = context.pages.find((item) => normalizeText(item.slug) === slug);
    if (bySlug) return bySlug;
  }

  if (title) {
    const byTitle = context.pages.find((item) => normalizeText(item.widget_title).includes(title));
    if (byTitle) return byTitle;
  }

  return context.pages[0] ?? null;
}

export async function streamWidgetChatReply(
  messages: WidgetChatMessage[],
  boardState: WidgetBoardStateItem[],
  toolContext: WidgetToolContext,
  userId: string,
  dashboardKey: string,
  chatMode: 'default' | 'new_view',
  onToken: (token: string) => void,
): Promise<void> {
  if (!client) {
    throw new Error('Missing VITE_GROQ_API_KEY. Add it to your environment to use chatbot.');
  }

  if (messages.length === 0 || messages[messages.length - 1]?.role !== 'user') {
    throw new Error('Last message must be a user message.');
  }
  if (!userId) {
    throw new Error('Missing authenticated user. Please sign in again.');
  }
  if (!dashboardKey) {
    throw new Error('Missing dashboard key.');
  }

  const lastUserMessage = messages[messages.length - 1].content;
  const priorMessages = messages.slice(0, -1).map((message) => ({
    role: message.role,
    content: message.content,
  }));

  const baseSystemLines = [
    ...(chatMode === 'default'
      ? [
        'You can use tools to open content for the user.',
        'If the user asks to open or show a page/video, call the matching tool.',
        'Use Open_Iframe for video/embedded content on the current board.',
        'Use Open_Page for internal page URLs/slugs.',
        'Use create_new_view when the user asks for a new widgets tab/view from intent.',
        'When using create_new_view, include page_about if user provided what the new page should cover.',
        'Use Edit_Page to modify the board when the user requests layout/content changes.',
        'Edit_Page supports exactly three operations: swap_content, reorder, replace_slot.',
        'Do not include raw UUIDs in replies unless user explicitly asks for IDs.',
        'For clarification questions, use one short sentence and ask only for missing fields.',
        'Prefer concise, low-token replies over verbose summaries.',
        'After tool usage, confirm what was opened.',
      ]
      : [
        'You are currently inside a non-overview widgets view.',
        'You may only use two tools: Rename_View and Dispatch.',
        'Use Rename_View when user asks to rename this view.',
        'Use Dispatch for research tasks.',
        'When user describes what this view should show, call Dispatch first so the page starts building immediately.',
        'Do not include raw UUIDs in replies unless user explicitly asks for IDs.',
        'Keep responses short and avoid repeating long source lists in chat.',
        'Do not try to create another view from here.',
      ]),
    'Keep responses concise and practical.',
  ];
  const systemPrompt = [
    'You are a helpful dashboard copilot.',
    ...baseSystemLines,
  ].join(' ');
  const model = 'openai/gpt-oss-120b';
  const supportsReasoningEffort = true;

  const payload = {
    user_message: lastUserMessage,
    board_state: boardState,
    available_open_targets: toolContext,
  };

  const defaultToolDefinitions = [
    {
      type: 'function',
      function: {
        name: 'Open_Iframe',
        description:
          'Open an iframe target that already exists on the current board. Provide iframe_id (widget UUID) or embedUrl.',
        parameters: {
          type: 'object',
          properties: {
            iframe_id: { type: 'string' },
            embedUrl: { type: 'string' },
            title: { type: 'string' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'Open_Page',
        description:
          'Open an internal page in fullscreen mode. Provide url or slug and optionally a title hint.',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            slug: { type: 'string' },
            title: { type: 'string' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'Edit_Page',
        description:
          'Edit widgets on this dashboard. Use swap_content, reorder, or replace_slot and target by target_uuid (preferred) or target_title.',
        parameters: {
          type: 'object',
          properties: {
            operation: { type: 'string', enum: ['swap_content', 'reorder', 'replace_slot'] },
            target_uuid: { type: 'string' },
            target_title: { type: 'string' },
            to_column: { type: 'number' },
            to_order: { type: 'number' },
            component_type: { type: 'string' },
            props_patch: { type: 'object' },
          },
          required: ['operation'],
        },
      },
    },
  ];
  const createNewViewTool = {
    type: 'function',
    function: {
      name: 'create_new_view',
      description:
        'Create a new widgets dashboard view based on user intent, then route user to that view.',
      parameters: {
        type: 'object',
        properties: {
          intent: { type: 'string' },
          view_name: { type: 'string' },
          page_about: { type: 'string' },
        },
        required: ['intent'],
      },
    },
  };
  const dispatchTool = {
    type: 'function',
    function: {
      name: 'Dispatch',
      description:
        'Send one or more jobs to subagents. researcher uses web research, youtube_related uses YouTube video research.',
      parameters: {
        type: 'object',
        properties: {
          jobs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Unique job ID for tracking' },
                agent: {
                  type: 'string',
                  enum: ['researcher', 'youtube_related', 'writer', 'page_builder', 'data_fetcher'],
                  description: 'Which subagent to use',
                },
                instructions: { type: 'string', description: 'What this subagent should do' },
                depends_on: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Job IDs that must complete before this one runs',
                },
              },
              required: ['id', 'agent', 'instructions'],
            },
          },
        },
        required: ['jobs'],
      },
    },
  };
  const renameViewTool = {
    type: 'function',
    function: {
      name: 'Rename_View',
      description:
        'Rename the current widgets view and navigate to its new URL slug.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'New display name for this view' },
          slug: { type: 'string', description: 'Optional custom URL slug' },
        },
        required: ['name'],
      },
    },
  };
  const toolDefinitions = chatMode === 'new_view'
    ? [renameViewTool, dispatchTool]
    : [...defaultToolDefinitions, createNewViewTool];

  const baseMessages: Array<Record<string, unknown>> = [
    {
      role: 'system',
      content: systemPrompt,
    },
    ...priorMessages,
    {
      role: 'user',
      content: JSON.stringify(payload, null, 2),
    },
  ];

  const firstResponse = await client.chat.completions.create({
    model,
    messages: baseMessages as never,
    tools: toolDefinitions as never,
    tool_choice: 'auto',
    temperature: 1,
    max_completion_tokens: 8192,
    top_p: 1,
    ...(supportsReasoningEffort ? { reasoning_effort: 'medium' as const } : {}),
    stream: false,
    stop: null,
  });

  const firstMessage = firstResponse.choices?.[0]?.message;
  const toolCalls = firstMessage?.tool_calls ?? [];

  if (toolCalls.length === 0) {
    const content = firstMessage?.content ?? '';
    if (content) onToken(content);
    return;
  }

  const toolResults: Array<{ tool_call_id: string; name: string; content: string }> = [];
  let dispatchRawText = '';

  for (const call of toolCalls) {
    const functionName = call.function?.name ?? '';
    let parsedArgs: Record<string, unknown> = {};
    try {
      parsedArgs = JSON.parse(call.function?.arguments ?? '{}') as Record<string, unknown>;
    } catch {
      parsedArgs = {};
    }

    if (functionName === 'Open_Iframe') {
      const target = pickIframeTarget(parsedArgs, toolContext);
      if (target) {
        publishWidgetAgentEvent({
          type: 'open_iframe',
          payload: {
            embedUrl: target.embedUrl,
            title: target.widget_title,
            subtitle: target.subtitle,
          },
        });
        toolResults.push({
          tool_call_id: call.id,
          name: functionName,
          content: JSON.stringify({ ok: true, target }),
        });
      } else {
        toolResults.push({
          tool_call_id: call.id,
          name: functionName,
          content: JSON.stringify({ ok: false, error: 'No iframe target found on this board.' }),
        });
      }
      continue;
    }

    if (functionName === 'Open_Page') {
      const target = pickPageTarget(parsedArgs, toolContext);
      if (target) {
        publishWidgetAgentEvent({
          type: 'open_page',
          payload: { url: target.url },
        });
        toolResults.push({
          tool_call_id: call.id,
          name: functionName,
          content: JSON.stringify({ ok: true, target }),
        });
      } else {
        toolResults.push({
          tool_call_id: call.id,
          name: functionName,
          content: JSON.stringify({ ok: false, error: 'No page target found on this board.' }),
        });
      }
    }

    if (functionName === 'Edit_Page') {
      try {
        const operation = String(parsedArgs.operation ?? '');
        if (operation !== 'swap_content' && operation !== 'reorder' && operation !== 'replace_slot') {
          throw new Error('Invalid Edit_Page operation.');
        }

        const baseTarget = {
          target_uuid: typeof parsedArgs.target_uuid === 'string' ? parsedArgs.target_uuid : undefined,
          target_title: typeof parsedArgs.target_title === 'string' ? parsedArgs.target_title : undefined,
        };

        const result = await applyEditPageOperation(
          userId,
          operation === 'swap_content'
            ? {
              operation,
              ...baseTarget,
              props_patch: (parsedArgs.props_patch as Record<string, unknown> | undefined) ?? {},
            }
            : operation === 'reorder'
              ? {
                operation,
                ...baseTarget,
                to_column: Number(parsedArgs.to_column ?? 1),
                to_order: Number(parsedArgs.to_order ?? 0),
              }
              : {
                operation,
                ...baseTarget,
                component_type: String(parsedArgs.component_type ?? ''),
                props_patch: (parsedArgs.props_patch as Record<string, unknown> | undefined) ?? {},
              },
          dashboardKey,
        );

        publishWidgetAgentEvent({
          type: 'edit_page_applied',
          payload: {
            operation: result.operation,
            target_uuid: result.target_uuid,
            to_column: result.operation === 'reorder' ? result.to_column : undefined,
            to_order: result.operation === 'reorder' ? result.to_order : undefined,
            component_type: result.operation !== 'reorder' ? result.component_type : undefined,
            props_patch: result.operation !== 'reorder' ? result.props_patch : undefined,
            affected_order: result.operation === 'reorder' ? result.affected_order : undefined,
          },
        });

        toolResults.push({
          tool_call_id: call.id,
          name: functionName,
          content: JSON.stringify({ ok: true, result }),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to apply edit.';
        toolResults.push({
          tool_call_id: call.id,
          name: functionName,
          content: JSON.stringify({ ok: false, error: message }),
        });
      }
    }

    if (functionName === 'create_new_view' && chatMode === 'default') {
      try {
        const intent = String(parsedArgs.intent ?? '').trim();
        if (!intent) throw new Error('create_new_view requires an intent.');
        const viewName = typeof parsedArgs.view_name === 'string' ? parsedArgs.view_name : '';
        const pageAbout = typeof parsedArgs.page_about === 'string' ? parsedArgs.page_about.trim() : '';
        const title = titleFromIntent(intent, viewName);
        const slug = slugFromIntent(intent, viewName);
        const autoPrompt = pageAbout || intent;
        const autoCollapseChat = pageAbout.length > 0;
        const query = new URLSearchParams({
          name: title,
          auto_generate: '1',
          auto_prompt: autoPrompt,
        });
        if (autoCollapseChat) {
          query.set('auto_collapse_chat', '1');
        }
        const url = `/widgets/view/${encodeURIComponent(slug)}?${query.toString()}`;

        publishWidgetAgentEvent({
          type: 'open_page',
          payload: { url },
        });

        toolResults.push({
          tool_call_id: call.id,
          name: functionName,
          content: JSON.stringify({
            ok: true,
            created_view: {
              dashboardKey: `dashboard-view-${slug}`,
              slug,
              title,
              intent,
              auto_prompt: autoPrompt,
              auto_collapse_chat: autoCollapseChat,
              url,
            },
          }),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create new view.';
        toolResults.push({
          tool_call_id: call.id,
          name: functionName,
          content: JSON.stringify({ ok: false, error: message }),
        });
      }
    }

    if (functionName === 'Dispatch' && chatMode === 'new_view') {
      try {
        const rawJobs = Array.isArray(parsedArgs.jobs) ? parsedArgs.jobs : [];
        const jobs: DispatchJob[] = [];
        for (const raw of rawJobs) {
          const candidate = raw as Record<string, unknown>;
          const id = typeof candidate.id === 'string' ? candidate.id : '';
          const agent = typeof candidate.agent === 'string' ? candidate.agent : '';
          const instructions = typeof candidate.instructions === 'string' ? candidate.instructions : '';
          const dependsOn = Array.isArray(candidate.depends_on)
            ? candidate.depends_on.filter((entry): entry is string => typeof entry === 'string')
            : undefined;
          if (!id || !agent || !instructions) continue;
          jobs.push({
            id,
            agent: agent as DispatchJob['agent'],
            instructions,
            ...(dependsOn ? { depends_on: dependsOn } : {}),
          });
        }

        if (jobs.length === 0) {
          throw new Error('Dispatch requires at least one valid job.');
        }

        const dispatchResult = await runDispatchResearchJobs(jobs);
        dispatchRawText = dispatchResult.text;

        if (dispatchResult.completedResearch.length > 0) {
          const generatedComponents = await buildGeneratedComponentsFromResearch(
            model,
            lastUserMessage,
            dispatchResult.completedResearch,
          );
          const upserted = await upsertGeneratedAgentComponents(userId, dashboardKey, generatedComponents);
          publishWidgetAgentEvent({
            type: 'generated_components_applied',
            payload: {
              widgets: upserted.widgets,
              uuidByLocalWidgetId: upserted.uuidByLocalWidgetId,
            },
          });
          const totalCount = generatedComponents.length;
          const videoCount = generatedComponents.filter((component) => component.component_type === 'videoCard').length;
          const citationCount = generatedComponents.filter((component) => component.component_type === 'sourceLinkCard').length;
          dispatchRawText = `${dispatchRawText}\n\nBuilt ${totalCount} components on this view: 2 content cards, ${videoCount} video cards, ${citationCount} citation cards.`;
        }

        toolResults.push({
          tool_call_id: call.id,
          name: functionName,
          content: JSON.stringify({
            ok: true,
            result_text: dispatchRawText,
            job_count: jobs.length,
          }),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Dispatch failed.';
        dispatchRawText = `Dispatch failed: ${message}`;
        toolResults.push({
          tool_call_id: call.id,
          name: functionName,
          content: JSON.stringify({ ok: false, error: message }),
        });
      }
    }

    if (functionName === 'Rename_View' && chatMode === 'new_view') {
      try {
        if (dashboardKey === DEFAULT_DASHBOARD_KEY) {
          throw new Error('Overview cannot be renamed.');
        }

        const name = String(parsedArgs.name ?? '').trim();
        if (!name) throw new Error('Rename_View requires a name.');
        const customSlug = typeof parsedArgs.slug === 'string' ? parsedArgs.slug.trim() : '';
        const nextSlug = customSlug ? slugifyView(customSlug) : slugifyView(name);
        const nextDashboardKey = `dashboard-view-${nextSlug}`;

        await renameDashboardView(userId, dashboardKey, nextDashboardKey);
        const url = `/widgets/view/${encodeURIComponent(nextSlug)}?name=${encodeURIComponent(name)}`;
        publishWidgetAgentEvent({
          type: 'open_page',
          payload: { url },
        });

        toolResults.push({
          tool_call_id: call.id,
          name: functionName,
          content: JSON.stringify({
            ok: true,
            renamed_to: {
              name,
              slug: nextSlug,
              dashboard_key: nextDashboardKey,
              url,
            },
          }),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Rename failed.';
        toolResults.push({
          tool_call_id: call.id,
          name: functionName,
          content: JSON.stringify({ ok: false, error: message }),
        });
      }
    }
  }

  if (dispatchRawText.trim()) {
    onToken(dispatchRawText);
    return;
  }

  const completion = await client.chat.completions.create({
    model,
    messages: [
      ...baseMessages,
      {
        role: 'assistant',
        content: firstMessage?.content ?? '',
        tool_calls: toolCalls,
      },
      ...toolResults.map((result) => ({
        role: 'tool' as const,
        tool_call_id: result.tool_call_id,
        name: result.name,
        content: result.content,
      })),
    ] as never,
    tools: toolDefinitions as never,
    temperature: 1,
    max_completion_tokens: 8192,
    top_p: 1,
    ...(supportsReasoningEffort ? { reasoning_effort: 'medium' as const } : {}),
    stream: true,
    stop: null,
  });

  for await (const chunk of completion) {
    const token = chunk.choices?.[0]?.delta?.content ?? '';
    if (token) onToken(token);
  }
}
