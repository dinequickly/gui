import { useState, useRef, useEffect } from 'react';
import './LLMBox.css';

export default function LLMBox({ onRefresh }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // { role: 'user'|'assistant', content: string }
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [liveActions, setLiveActions] = useState([]); // action labels shown while streaming
  const [liveText, setLiveText] = useState('');       // streaming assistant text

  const msgsEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Scroll to bottom whenever messages or live content change
  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, liveText, liveActions]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  async function submit() {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setLiveActions([]);
    setLiveText('');

    const userMsg = { role: 'user', content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        throw new Error(`Server error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let accText = '';
      let didRefresh = false;
      let pendingEvent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop(); // keep incomplete last line

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            pendingEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            let data;
            try { data = JSON.parse(line.slice(6)); } catch { continue; }

            switch (pendingEvent) {
              case 'action':
                setLiveActions(prev => [...prev, data.label]);
                break;
              case 'delta':
                accText += data.content;
                setLiveText(accText);
                break;
              case 'refresh':
                didRefresh = true;
                break;
              case 'error':
                accText = `Error: ${data.message}`;
                setLiveText(accText);
                break;
              case 'done':
                break;
            }
            pendingEvent = '';
          }
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: accText }]);
      setLiveText('');
      setLiveActions([]);
      if (didRefresh && onRefresh) onRefresh();
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
      setLiveText('');
      setLiveActions([]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  const showStream = loading && (liveActions.length > 0 || liveText);
  const showThinking = loading && !liveActions.length && !liveText;

  return (
    <div className={`llm-box${open ? ' llm-box--open' : ''}`}>
      <button
        className="llm-box__toggle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="llm-box__toggle-label">Ask Grabbit</span>
        <span className="llm-box__toggle-chevron">{open ? '▼' : '▲'}</span>
      </button>

      {open && (
        <div className="llm-box__body">
          <div className="llm-box__messages">
            {messages.length === 0 && !loading && (
              <p className="llm-box__hint">
                Ask me to create, update, or delete items — e.g. "Archive everything older than a week" or "Star all items tagged AI".
              </p>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`llm-msg llm-msg--${m.role}`}>
                {m.role === 'user' ? m.content : <MessageText text={m.content} />}
              </div>
            ))}

            {/* Live streaming area */}
            {showThinking && (
              <div className="llm-thinking">Thinking…</div>
            )}
            {showStream && (
              <div className="llm-msg llm-msg--assistant llm-msg--streaming">
                {liveActions.map((a, i) => (
                  <div key={i} className="llm-action">{a}</div>
                ))}
                {liveText && <MessageText text={liveText} />}
              </div>
            )}

            <div ref={msgsEndRef} />
          </div>

          <div className="llm-box__input-row">
            <textarea
              ref={textareaRef}
              className="llm-box__input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="e.g. Archive all Archived items, Star anything tagged 'AI'…"
              rows={1}
              disabled={loading}
            />
            <button
              className="llm-box__send"
              onClick={submit}
              disabled={loading || !input.trim()}
            >
              {loading ? '…' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Render assistant text preserving newlines
function MessageText({ text }) {
  return (
    <span>
      {text.split('\n').map((line, i, arr) => (
        <span key={i}>
          {line}
          {i < arr.length - 1 && <br />}
        </span>
      ))}
    </span>
  );
}
