export const BLOCK_SCHEMAS = {
  citation: {
    label: 'Citation',
    required: ['title', 'url'],
  },
  iframe: {
    label: 'Embed',
    required: ['url'],
  },
  subpage: {
    label: 'Subpage',
    required: ['title', 'description'],
  },
  text: {
    label: 'Text',
    required: ['body'],
    defaultBindingProp: 'body',
  },
  quiz: {
    label: 'Assessment',
    required: ['questions'],
    defaultBindingProp: 'heading',
  },
  assessment: {
    label: 'Assessment',
    required: ['mode'],
    defaultBindingProp: 'heading',
  },
  desmos: {
    label: 'Desmos',
    required: ['graphUrl'],
  },
  chatbot: {
    label: 'Tutor Chat',
    required: ['persona'],
  },
  heading_1: {
    label: 'Heading 1',
    required: ['text'],
    defaultBindingProp: 'text',
  },
  heading_2: {
    label: 'Heading 2',
    required: ['text'],
    defaultBindingProp: 'text',
  },
  heading_3: {
    label: 'Heading 3',
    required: ['text'],
    defaultBindingProp: 'text',
  },
  bulleted_list: {
    label: 'Bulleted List',
    required: ['items'],
  },
  numbered_list: {
    label: 'Numbered List',
    required: ['items'],
  },
  todo_list: {
    label: 'Todo List',
    required: ['items'],
  },
  toggle_list: {
    label: 'Toggle',
    required: ['title', 'body'],
  },
  callout: {
    label: 'Callout',
    required: ['text'],
    defaultBindingProp: 'text',
  },
  code: {
    label: 'Code',
    required: ['code'],
  },
  glossary: {
    label: 'Glossary',
    required: [],
  },
  agent: {
    label: 'Agent',
    required: ['prompt'],
    defaultBindingProp: 'prompt',
  },
  button: {
    label: 'Button',
    required: ['label'],
  },
  progress: {
    label: 'Progress',
    required: [],
  },
};

export function getBlockSchema(type) {
  if (type === 'quiz') return BLOCK_SCHEMAS.assessment;
  return BLOCK_SCHEMAS[type];
}

export function getDefaultBindingProp(type) {
  return getBlockSchema(type)?.defaultBindingProp || null;
}

export function validateBlock(block) {
  if (!block?.type) {
    return ['Missing block type'];
  }

  const schema = getBlockSchema(block.type);
  if (!schema) {
    return [];
  }

  const errors = [];
  for (const field of schema.required) {
    const value = block[field];
    const missingArray = Array.isArray(value) && value.length === 0;
    if (value === undefined || value === null || value === '' || missingArray) {
      errors.push(`Missing required prop "${field}"`);
    }
  }

  if ((block.type === 'assessment' || block.type === 'quiz') && !isValidAssessmentMode(block)) {
    errors.push(`Unsupported assessment mode "${block.mode || 'multiple_choice'}"`);
  }

  return errors;
}

export function isKnownBlockType(type) {
  return Boolean(getBlockSchema(type));
}

export function isValidAssessmentMode(block) {
  const mode = block.mode || (block.type === 'quiz' ? 'multiple_choice' : undefined);
  return ['multiple_choice', 'free_response', 'interactive_slider', 'drag_sort'].includes(mode);
}
