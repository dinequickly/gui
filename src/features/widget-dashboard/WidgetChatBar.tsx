import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { WidgetBoardStateItem, WidgetToolContext } from './boardState';
import { streamWidgetChatReply } from './widgetChatbot';

const MAX_CHAT_INPUT_CHARS = 400;
const MAX_RESPONSE_PREVIEW_CHARS = 240;
const MAX_RESPONSE_PREVIEW_LINES = 4;

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
  autoRunPrompt?: string;
  autoCollapseOnAutoRun?: boolean;
};

function truncateResponsePreview(content: string): string {
  const lines = content.split('\n');
  const trimmedByLines = lines.slice(0, MAX_RESPONSE_PREVIEW_LINES).join('\n');
  if (trimmedByLines.length <= MAX_RESPONSE_PREVIEW_CHARS && lines.length <= MAX_RESPONSE_PREVIEW_LINES) {
    return trimmedByLines;
  }
  return `${trimmedByLines.slice(0, MAX_RESPONSE_PREVIEW_CHARS).trimEnd()}…`;
}

function renderTextWithLinks(content: string): ReactNode[] {
  const lines = content.split('\n');
  return lines.map((line, lineIndex) => {
    const parts = line.split(/(https?:\/\/[^\s]+)/g);
    return (
      <p key={`line-${lineIndex}`} className="chatbar-response-line">
        {parts.map((part, partIndex) => {
          if (!part) return null;
          const isUrl = /^https?:\/\/[^\s]+$/i.test(part);
          if (!isUrl) {
            return <span key={`part-${lineIndex}-${partIndex}`}>{part}</span>;
          }
          return (
            <a
              key={`part-${lineIndex}-${partIndex}`}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="chatbar-response-link"
              title={part}
            >
              {part}
            </a>
          );
        })}
      </p>
    );
  });
}

export function WidgetChatBar({
  boardState,
  toolContext,
  userId,
  dashboardKey,
  chatMode = 'default',
  theaterMode = false,
  starterPrompt = '',
  autoRunPrompt = '',
  autoCollapseOnAutoRun = false,
}: Props) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isResponseExpanded, setIsResponseExpanded] = useState(false);
  const lastAutoRunKeyRef = useRef('');
  const messagesRef = useRef<ChatUiMessage[]>([]);

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
  const hasLongResponse = useMemo(() => {
    if (!latestAssistantReply.trim()) return false;
    const lineCount = latestAssistantReply.split('\n').length;
    return latestAssistantReply.length > MAX_RESPONSE_PREVIEW_CHARS || lineCount > MAX_RESPONSE_PREVIEW_LINES;
  }, [latestAssistantReply]);
  const responseToRender = useMemo(() => {
    if (!hasLongResponse || isResponseExpanded) return latestAssistantReply;
    return truncateResponsePreview(latestAssistantReply);
  }, [hasLongResponse, isResponseExpanded, latestAssistantReply]);
  const hasResponse = Boolean(latestAssistantReply || isLoading);
  const shouldStackBubble = hasResponse && !isCollapsed;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    setMessages([]);
    lastAutoRunKeyRef.current = '';
    setIsCollapsed(false);
    setIsResponseExpanded(false);
  }, [chatMode, dashboardKey]);

  useEffect(() => {
    if (autoRunPrompt.trim()) return;
    if (!starterPrompt.trim()) return;
    if (messages.length > 0) return;
    setMessages([{ role: 'assistant', content: starterPrompt }]);
  }, [autoRunPrompt, messages.length, starterPrompt]);

  useEffect(() => {
    setIsResponseExpanded(false);
  }, [latestAssistantReply]);

  useEffect(() => {
    if (chatMode !== 'new_view') return;
    if (!autoCollapseOnAutoRun) return;
    if (!autoRunPrompt.trim()) return;
    setIsCollapsed(true);
  }, [autoCollapseOnAutoRun, autoRunPrompt, chatMode]);

  async function sendMessage(content: string) {
    const nextInput = content.trim();
    if (!nextInput || isLoading) return;

    const userMessage: ChatUiMessage = { role: 'user', content: nextInput };
    const preparedMessages = [...messagesRef.current, userMessage];
    setMessages(preparedMessages);
    setIsLoading(true);

    const assistantIndex = preparedMessages.length;
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      await streamWidgetChatReply(preparedMessages, boardState, toolContext, userId, dashboardKey, chatMode, (token) => {
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

  async function handleSend() {
    if (!input.trim() || isLoading) return;
    const nextInput = input;
    setInput('');
    await sendMessage(nextInput);
  }

  useEffect(() => {
    if (chatMode !== 'new_view') return;
    const prompt = autoRunPrompt.trim();
    if (!prompt) return;
    if (isLoading) return;
    const autoRunKey = `${dashboardKey}::${prompt}`;
    if (lastAutoRunKeyRef.current === autoRunKey) return;
    lastAutoRunKeyRef.current = autoRunKey;
    void sendMessage(prompt);
  }, [autoRunPrompt, chatMode, dashboardKey, isLoading]);

  return (
    <div className={`dashboard-chatbar-wrap ${theaterMode ? 'theater-mode' : ''}`}>
      <div
        className={`dashboard-chatbar ${isCollapsed ? 'is-collapsed' : ''} ${shouldStackBubble ? 'has-response' : ''}`}
        role="group"
        aria-label="Customize your view"
      >
        {isLoading ? (
          <div className="chatbar-toolbar" aria-live="polite">
            <div className="chatbar-status">
              <span className="chatbar-status-dot is-active" aria-hidden="true" />
              <span>Building this view live…</span>
            </div>
          </div>
        ) : null}

        {isCollapsed ? (
          <button
            type="button"
            className="chatbar-collapsed-note"
            onClick={() => setIsCollapsed(false)}
          >
            {isLoading ? 'Compacting logs while components stream into this page.' : 'Chat is tucked away so you can focus on the board.'}
          </button>
        ) : (
          <>
            {hasResponse ? (
              <div className="chatbar-response" aria-live="polite">
                {isLoading && !latestAssistantReply.trim()
                  ? 'Thinking...'
                  : renderTextWithLinks(responseToRender)}
              </div>
            ) : null}
            {hasLongResponse ? (
              <button
                className="chatbar-expand-response-btn"
                type="button"
                onClick={() => setIsResponseExpanded((prev) => !prev)}
              >
                {isResponseExpanded ? 'Show less' : 'Show full output'}
              </button>
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
                maxLength={MAX_CHAT_INPUT_CHARS}
                onChange={(event) => setInput(event.target.value.slice(0, MAX_CHAT_INPUT_CHARS))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
              />

              <button
                className="chatbar-icon-btn chatbar-send-btn"
                aria-label={isLoading ? 'Sending message' : 'Send message'}
                type="button"
                disabled={!canSend}
                onClick={() => { void handleSend(); }}
              >
                {isLoading ? (
                  <span className="chatbar-send-spinner" aria-hidden="true" />
                ) : (
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 18 18 12 6 6" />
                  </svg>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
