import { useState, useRef, useEffect } from 'react';
import './BlockChat.css';

export default function BlockChat({ block }) {
  const [messages, setMessages] = useState(
    block.greeting ? [{ role: 'assistant', content: block.greeting }] : []
  );
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg = { role: 'user', content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setStreaming(true);

    // Placeholder for streaming response
    setMessages(m => [...m, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/block-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.filter(m => m.role !== 'system'),
          persona: block.persona,
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (currentEvent === 'delta' && data.content) {
                setMessages(m => {
                  const copy = [...m];
                  copy[copy.length - 1] = {
                    role: 'assistant',
                    content: copy[copy.length - 1].content + data.content,
                  };
                  return copy;
                });
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      setMessages(m => {
        const copy = [...m];
        copy[copy.length - 1] = { role: 'assistant', content: 'Error: ' + err.message };
        return copy;
      });
    }

    setStreaming(false);
  }

  return (
    <div className="bc">
      <div className="bc__header">{block.title || 'Tutor'}</div>
      <div className="bc__messages">
        {messages.length === 0 && (
          <p className="bc__hint">Ask a question to get started.</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`bc__msg bc__msg--${msg.role}`}>
            {msg.content || (streaming && i === messages.length - 1 ? '…' : '')}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="bc__input-row">
        <input
          className="bc__input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
          placeholder="Ask a question…"
          disabled={streaming}
        />
        <button
          className="bc__send"
          onClick={send}
          disabled={streaming || !input.trim()}
        >
          →
        </button>
      </div>
    </div>
  );
}
