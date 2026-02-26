export type WidgetAgentEvent =
  | {
    type: 'open_iframe';
    payload: {
      embedUrl: string;
      title?: string;
      subtitle?: string;
    };
  }
  | {
    type: 'open_page';
    payload: {
      url: string;
    };
  }
  | {
    type: 'edit_page_applied';
    payload: {
      operation: 'swap_content' | 'reorder' | 'replace_slot';
      target_uuid: string;
      to_column?: number;
      to_order?: number;
      component_type?: string;
      props_patch?: Record<string, unknown>;
      affected_order?: Array<{ uuid: string; column: number; order: number }>;
    };
  };

const EVENT_NAME = 'widget-agent-tool-event';

export function publishWidgetAgentEvent(event: WidgetAgentEvent) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<WidgetAgentEvent>(EVENT_NAME, { detail: event }));
}

export function subscribeWidgetAgentEvents(
  handler: (event: WidgetAgentEvent) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener: EventListener = (rawEvent) => {
    const event = rawEvent as CustomEvent<WidgetAgentEvent>;
    if (event.detail) handler(event.detail);
  };
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
