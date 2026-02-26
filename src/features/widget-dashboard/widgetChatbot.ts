import { Groq } from 'groq-sdk';
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
import { resolveSlotSlug, slugifyView } from './viewRoutes';

export type WidgetChatRole = 'user' | 'assistant';

export interface WidgetChatMessage {
  role: WidgetChatRole;
  content: string;
}

const groqApiKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined;

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
  const slotFromPreferred = resolveSlotSlug(preferredName ?? '');
  if (slotFromPreferred) return slotFromPreferred;
  const slotFromIntent = resolveSlotSlug(intent);
  if (slotFromIntent) return slotFromIntent;
  return slugifyView(preferredName ?? intent);
}

type DispatchJob = {
  id: string;
  agent: 'researcher' | 'writer' | 'page_builder' | 'data_fetcher';
  instructions: string;
  depends_on?: string[];
};

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
  return { title, subtitle, body };
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

function buildCitationFallback(results: ResearchJobResult[]): GeneratedCardDraft {
  const links: string[] = [];
  for (const job of results) {
    for (const item of job.results.slice(0, 5)) {
      if (!item.url) continue;
      links.push(`- ${item.title || 'Source'} — ${item.url}`);
      if (links.length >= 12) break;
    }
    if (links.length >= 12) break;
  }
  return {
    title: 'Citations',
    subtitle: 'Sources',
    body: links.length > 0 ? links.join('\n') : 'No citations found.',
  };
}

async function runCardSubagent(
  model: string,
  system: string,
  userPrompt: string,
  fallback: GeneratedCardDraft,
): Promise<GeneratedCardDraft> {
  if (!client) return fallback;
  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      max_completion_tokens: 1200,
      top_p: 1,
      reasoning_effort: 'medium',
      stream: false,
    });
    const raw = completion.choices?.[0]?.message?.content ?? '';
    if (!raw.trim()) return fallback;
    return parseGeneratedCardDraft(raw);
  } catch {
    return fallback;
  }
}

async function buildGeneratedComponentsFromResearch(
  model: string,
  intent: string,
  results: ResearchJobResult[],
): Promise<GeneratedAgentComponent[]> {
  const context = buildResearchContext(results);
  const citationsFallback = buildCitationFallback(results);

  const [cardA, cardB, citations] = await Promise.all([
    runCardSubagent(
      model,
      'You create one dashboard content card. Return ONLY JSON: {"title":"...","subtitle":"...","body":"..."}',
      `User intent: ${intent}\n\nResearch:\n${context}\n\nCreate a concise executive summary card.`,
      {
        title: 'Executive Summary',
        subtitle: 'Key Takeaways',
        body: 'Highlights generated from current research results.',
      },
    ),
    runCardSubagent(
      model,
      'You create one dashboard content card. Return ONLY JSON: {"title":"...","subtitle":"...","body":"..."}',
      `User intent: ${intent}\n\nResearch:\n${context}\n\nCreate a second card focused on details, metrics, and notable commentary.`,
      {
        title: 'Details',
        subtitle: 'Metrics and Commentary',
        body: 'Detailed notes generated from current research results.',
      },
    ),
    runCardSubagent(
      model,
      'You create one citation card. Return ONLY JSON: {"title":"...","subtitle":"...","body":"..."} where body is a bullet list of sources with URLs.',
      `User intent: ${intent}\n\nResearch:\n${context}\n\nCreate a citations card with bullets formatted like "- Source Title — URL". Include only sources present in the research context.`,
      citationsFallback,
    ),
  ]);

  return [
    { slot: 'page_creator_a', title: cardA.title, subtitle: cardA.subtitle, body: cardA.body },
    { slot: 'page_creator_b', title: cardB.title, subtitle: cardB.subtitle, body: cardB.body },
    { slot: 'citation_creator', title: citations.title, subtitle: citations.subtitle, body: citations.body },
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

async function runDispatchResearchJobs(jobs: DispatchJob[]): Promise<DispatchResearchResult> {
  const supported = jobs.filter((job) => job.agent === 'researcher');
  const unsupported = jobs.filter((job) => job.agent !== 'researcher');

  const outputs = await Promise.all(
    supported.map(async (job) => {
      try {
        return await runPerplexityResearchJob(job);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown researcher error.';
        return {
          id: job.id,
          instructions: job.instructions,
          results: [],
          text: `[${job.id}] ERROR: ${message}`,
        } satisfies ResearchJobResult;
      }
    }),
  );

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
        'Use Edit_Page to modify the board when the user requests layout/content changes.',
        'Edit_Page supports exactly three operations: swap_content, reorder, replace_slot.',
        'After tool usage, confirm what was opened.',
      ]
      : [
        'You are currently inside a non-overview widgets view.',
        'You may only use two tools: Rename_View and Dispatch.',
        'Use Rename_View when user asks to rename this view.',
        'Use Dispatch for research tasks.',
        'Do not try to create another view from here.',
      ]),
    'Keep responses concise and practical.',
  ];
  const systemPrompt = chatMode === 'new_view'
    ? [
      'You are a pirate dashboard copilot. Speak in a friendly pirate voice.',
      'Keep the pirate style obvious but readable.',
      ...baseSystemLines,
    ].join(' ')
    : [
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
        'Send one or more jobs to subagents. For now, only researcher jobs are implemented and run in parallel.',
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
                  enum: ['researcher', 'writer', 'page_builder', 'data_fetcher'],
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
        const title = titleFromIntent(intent, viewName);
        const slug = slugFromIntent(intent, viewName);
        const url = `/widgets/view/${encodeURIComponent(slug)}?name=${encodeURIComponent(title)}`;

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
          dispatchRawText = `${dispatchRawText}\n\nBuilt 3 components on this view: 2 content cards + 1 citations card.`;
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
