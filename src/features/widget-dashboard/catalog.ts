import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react';
import { z } from 'zod';

export const widgetCatalog = defineCatalog(schema, {
  actions: {},
  components: {
    // Layout
    GlassGrid: {
      props: z.object({
        columns: z.string().optional(),
        areas: z.string().optional(),
        gap: z.number().optional(),
      }),
      description:
        'CSS Grid layout container for arranging glass widgets. Children placed in grid cells. Use areas for named placement.',
    },
    GlassCard: {
      props: z.object({ padding: z.string().optional() }),
      description: 'Generic glassmorphism container card. Accepts children.',
    },

    // Data-bound widgets
    NotificationStack: {
      props: z.object({}),
      description:
        'Renders todo cards from the widget-todos database with title, assignee, and date. No children.',
    },
    ReminderBlock: {
      props: z.object({}),
      description:
        'Renders reminder shortcut buttons from the widget-reminders database. No children.',
    },
    PageCard: {
      props: z.object({
        recordId: z.string(),
        variant: z.enum(['small', 'large', 'large-image']),
      }),
      description:
        'Renders a page card from the widget-pages database by record ID. Variants: "small" = centered text with author, "large" = title+subtitle+body, "large-image" = title+subtitle with abstract image on right. All have Read/Visit Link glass buttons. No children.',
    },

    // Typography
    GlassHeading: {
      props: z.object({
        text: z.string(),
        level: z.enum(['h1', 'h2', 'h3']).optional(),
      }),
      description: 'Glass-styled heading with white text. No children.',
    },
    GlassText: {
      props: z.object({ content: z.string() }),
      description:
        'Glass-styled body text paragraph with translucent white text. No children.',
    },
  },
});
