import { Groq } from 'groq-sdk';
import { createSpecStreamCompiler } from '@json-render/core';
import type { Spec } from '@json-render/core';
import { widgetCatalog } from './catalog';

const client = new Groq({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  dangerouslyAllowBrowser: true,
});

export async function generateWidgetSpec(
  userPrompt: string,
  onUpdate: (spec: Spec) => void,
): Promise<void> {
  const compiler = createSpecStreamCompiler<Spec>();

  const systemPrompt = widgetCatalog.prompt({
    customRules: [
      'You are arranging glassmorphism widgets over a Monet "Water Lilies" background.',
      'There are 3 seeded databases with these well-known record IDs:',
      '  - widget-pages: records "wpr1" (small, "Vintage Glory"), "wpr2" (large, "Organic Forms"), "wpr3" (large, "Nostalgia")',
      '  - widget-todos: todos are loaded automatically by NotificationStack (no record IDs needed)',
      '  - widget-reminders: reminders are loaded automatically by ReminderBlock (no record IDs needed)',
      'For PageCard elements, use keys like "page-<recordId>" (e.g. "page-wpr1").',
      'Default layout hint: notifications top-left (column 1), reminders top-right spanning 2 columns, page cards in the bottom row.',
      'GlassGrid areas use "/" to separate rows. Example: "notifs reminders reminders / tall wide right".',
      'NEVER use repeat, $state, $item, $bindState, or $bindItem. All data is static from seeded databases.',
      'Each PageCard must specify a variant: "small" for compact text, "large" for title+body, "large-image" for title+abstract image.',
    ],
  });

  const stream = await client.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    messages: [
      {
        role: 'system',
        content: `${systemPrompt}\n\nYou are generating a glassmorphism widget dashboard layout. Arrange the glass components to create a beautiful, iPad-like home screen.`,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    temperature: 1,
    max_completion_tokens: 4096,
    top_p: 1,
    reasoning_effort: 'medium',
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      const { result, newPatches } = compiler.push(content);
      if (newPatches.length > 0 && result.root && result.elements?.[result.root]) {
        onUpdate({ ...result, elements: { ...result.elements } });
      }
    }
  }

  const { result: final } = compiler.push('\n');
  if (final.root && final.elements?.[final.root]) {
    onUpdate({ ...final, elements: { ...final.elements } });
  }
}
