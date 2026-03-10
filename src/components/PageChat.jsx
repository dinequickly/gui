import { useState, useRef, useEffect } from 'react';
import './PageChat.css';

export default function PageChat({ blocks, onBlocksChange, pageContext, saveBlocks }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [liveActions, setLiveActions] = useState([]);
  const [liveText, setLiveText] = useState('');

  const msgsEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, liveText, liveActions]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  async function submit(text) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    setInput('');
    setLiveActions([]);
    setLiveText('');

    const userMsg = { role: 'user', content: msg };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const res = await fetch('/api/page-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
          blocks,
          pageContext,
        }),
      });

      if (!res.ok) throw new Error(`Server error ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let accText = '';
      let pendingEvent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();

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
              case 'blocks':
                // Live canvas update — propagate up and save to disk immediately
                onBlocksChange(data.blocks);
                saveBlocks(data.blocks);
                break;
              case 'error':
                accText = `Error: ${data.message}`;
                setLiveText(accText);
                break;
            }
            pendingEvent = '';
          }
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: accText }]);
      setLiveText('');
      setLiveActions([]);
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

  const showThinking = loading && !liveActions.length && !liveText;
  const showStream   = loading && (liveActions.length > 0 || liveText);

  return (
    <div className={`pc${open ? ' pc--open' : ''}`}>
      <div className="pc__bar">
        <button className="pc__toggle" onClick={() => setOpen(o => !o)} aria-expanded={open}>
          <span className="pc__toggle-label">Ask AI</span>
          <span className="pc__toggle-chevron">{open ? '▼' : '▲'}</span>
        </button>

        {/* Quick actions always visible in the bar */}
        {!open && (
          <div className="pc__quick">
            <button
              className="pc__quick-btn"
              onClick={() => { setOpen(true); submit('Enrich this page with more blocks'); }}
              disabled={loading}
            >
              ✦ Enrich
            </button>
            <button
              className="pc__quick-btn"
              onClick={() => { setOpen(true); submit('Add a citation block for the most relevant foundational paper'); }}
              disabled={loading}
            >
              + Citation
            </button>
            <button
              className="pc__quick-btn"
              onClick={() => { setOpen(true); submit('Add a YouTube iframe for the most relevant talk or lecture on this topic'); }}
              disabled={loading}
            >
              + Video
            </button>
          </div>
        )}
      </div>

      {open && (
        <div className="pc__body">
          <div className="pc__messages">
            {messages.length === 0 && !loading && (
              <p className="pc__hint">
                Ask me to add citations, iframes, deep-dives, or analysis — or just say "enrich this page".
              </p>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`pc-msg pc-msg--${m.role}`}>
                {m.role === 'user' ? m.content : <MsgText text={m.content} />}
              </div>
            ))}

            {showThinking && <div className="pc-thinking">Thinking…</div>}

            {showStream && (
              <div className="pc-msg pc-msg--assistant pc-msg--streaming">
                {liveActions.map((a, i) => (
                  <div key={i} className="pc-action">{a}</div>
                ))}
                {liveText && <MsgText text={liveText} />}
              </div>
            )}

            <div ref={msgsEndRef} />
          </div>

          <div className="pc__input-row">
            <div className="pc__quick-row">
              <button className="pc__quick-btn" disabled={loading}
                onClick={() => submit('Enrich this page with more blocks')}>✦ Enrich</button>
              <button className="pc__quick-btn" disabled={loading}
                onClick={() => submit('Add a citation block for the most relevant foundational paper')}>+ Citation</button>
              <button className="pc__quick-btn" disabled={loading}
                onClick={() => submit('Add a YouTube iframe for the most relevant talk or lecture on this topic')}>+ Video</button>
              <button className="pc__quick-btn" disabled={loading}
                onClick={() => submit('Add a text block with a "Why This Matters" analysis section')}>+ Analysis</button>
              <button className="pc__quick-btn" disabled={loading}
                onClick={() => submit('Add a subpage deep-dive block for the most interesting related topic')}>+ Deep Dive</button>
            </div>

            <div className="pc__input-wrap">
              <textarea
                ref={textareaRef}
                className="pc__input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="e.g. Delete the iframe, add two more citations, move the analysis to the top…"
                rows={1}
                disabled={loading}
              />
              <button
                className="pc__send"
                onClick={() => submit()}
                disabled={loading || !input.trim()}
              >
                {loading ? '…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MsgText({ text }) {
  return (
    <span>
      {text.split('\n').map((line, i, arr) => (
        <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
      ))}
    </span>
  );
}
