import { useEffect, useMemo, useState } from 'react';
import type { WidgetBoardStateItem, WidgetToolContext } from './boardState';
import { streamWidgetChatReply } from './widgetChatbot';

type ChatUiMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type Props = {
  boardState: WidgetBoardStateItem[];
  toolContext: WidgetToolContext;
  userId: string;
  dashboardKey: string;
  chatMode?: 'default' | 'new_view';
  theaterMode?: boolean;
  starterPrompt?: string;
};

export function WidgetChatBar({
  boardState,
  toolContext,
  userId,
  dashboardKey,
  chatMode = 'default',
  theaterMode = false,
  starterPrompt = '',
}: Props) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);

  const canSend = useMemo(() => {
    return !isLoading && input.trim().length > 0;
  }, [input, isLoading]);

  const latestAssistantReply = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (message.role === 'assistant' && message.content.trim()) {
        return message.content;
      }
    }
    return '';
  }, [messages]);

  useEffect(() => {
    setMessages([]);
  }, [chatMode, dashboardKey]);

  useEffect(() => {
    if (!starterPrompt.trim()) return;
    if (messages.length > 0) return;
    setMessages([{ role: 'assistant', content: starterPrompt }]);
  }, [messages.length, starterPrompt]);

  async function handleSend() {
    const nextInput = input.trim();
    if (!nextInput || isLoading) return;

    const userMessage: ChatUiMessage = { role: 'user', content: nextInput };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setIsLoading(true);

    const assistantIndex = nextMessages.length;
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      await streamWidgetChatReply(nextMessages, boardState, toolContext, userId, dashboardKey, chatMode, (token) => {
        setMessages((prev) => {
          const updated = [...prev];
          const current = updated[assistantIndex];
          if (!current || current.role !== 'assistant') return prev;
          updated[assistantIndex] = { ...current, content: current.content + token };
          return updated;
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send message.';
      console.error('[WidgetChatBar] Failed to send message:', message);
      setMessages((prev) => {
        const updated = [...prev];
        const current = updated[assistantIndex];
        if (current && current.role === 'assistant' && !current.content.trim()) {
          updated[assistantIndex] = { role: 'assistant', content: 'Sorry, I could not respond right now.' };
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={`dashboard-chatbar-wrap ${theaterMode ? 'theater-mode' : ''}`}>
      <div className="dashboard-chatbar" role="group" aria-label="Customize your view">
        {(latestAssistantReply || isLoading) ? (
          <div className="chatbar-response" aria-live="polite">
            {latestAssistantReply || 'Thinking...'}
          </div>
        ) : null}

        <div className="chatbar-row">
          <button
            className="chatbar-icon-btn"
            aria-label="Reset chat context"
            type="button"
            onClick={() => setMessages([])}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round">
              <path d="M5 12h14" />
            </svg>
          </button>

          <input
            type="text"
            className="chatbar-input"
            placeholder="Customize your view.."
            aria-label="Customize your view"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void handleSend();
              }
            }}
          />

          <button
            className="chatbar-icon-btn chatbar-send-btn"
            aria-label="Send message"
            type="button"
            disabled={!canSend}
            onClick={() => { void handleSend(); }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 18 18 12 6 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
