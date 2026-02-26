import { Groq } from 'groq-sdk';
import type {
  WidgetBoardStateItem,
  WidgetIframeTarget,
  WidgetPageTarget,
  WidgetToolContext,
} from './boardState';
import { publishWidgetAgentEvent } from './agentToolEvents';
import { applyEditPageOperation } from './supabaseComponents';

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

  const lastUserMessage = messages[messages.length - 1].content;
  const priorMessages = messages.slice(0, -1).map((message) => ({
    role: message.role,
    content: message.content,
  }));

  const systemPrompt = [
    'You are a helpful dashboard copilot.',
    'You can use tools to open content for the user.',
    'If the user asks to open or show a page/video, call the matching tool.',
    'Use Open_Iframe for video/embedded content on the current board.',
    'Use Open_Page for internal page URLs/slugs.',
    'Use Edit_Page to modify the board when the user requests layout/content changes.',
    'Edit_Page supports exactly three operations: swap_content, reorder, replace_slot.',
    'After tool usage, confirm what was opened.',
    'Keep responses concise and practical.',
  ].join(' ');

  const payload = {
    user_message: lastUserMessage,
    board_state: boardState,
    available_open_targets: toolContext,
  };

  const toolDefinitions = [
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
    model: 'openai/gpt-oss-120b',
    messages: baseMessages as never,
    tools: toolDefinitions as never,
    tool_choice: 'auto',
    temperature: 1,
    max_completion_tokens: 8192,
    top_p: 1,
    reasoning_effort: 'medium',
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
  }

  const completion = await client.chat.completions.create({
    model: 'openai/gpt-oss-120b',
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
    reasoning_effort: 'medium',
    stream: true,
    stop: null,
  });

  for await (const chunk of completion) {
    const token = chunk.choices?.[0]?.delta?.content ?? '';
    if (token) onToken(token);
  }
}
