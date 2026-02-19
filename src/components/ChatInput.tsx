'use client';

import { useState, useRef } from 'react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSendMessage, disabled }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (input.trim() && !disabled) {
      onSendMessage(input.trim());
      setInput('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 130) + 'px';
  };

  return (
    <div style={{ borderTop: '1px solid #e5e1d8', background: '#ffffff', padding: '14px 20px 18px', flexShrink: 0 }}>
      <style>{`
        .chat-ta::placeholder { color: #c0bcb4; }
        .chat-ta:focus { outline: none; }
        .send-btn { transition: all 0.15s ease; cursor: pointer; }
        .send-btn:hover:not(:disabled) { background: linear-gradient(135deg, #7c5cff, #5b52f0) !important; transform: scale(1.05); }
        .send-btn:disabled { opacity: 0.3; cursor: not-allowed; transform: none !important; }
      `}</style>

      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: '10px',
        background: '#faf9f6',
        border: `1.5px solid ${focused ? '#b5a0ff' : '#e5e1d8'}`,
        borderRadius: '14px', padding: '10px 10px 10px 16px',
        boxShadow: focused ? '0 0 0 3px rgba(109,74,255,0.08)' : 'none',
        transition: 'all 0.18s ease',
      }}>
        <textarea
          ref={textareaRef}
          className="chat-ta"
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Ask a question about the document..."
          disabled={disabled}
          rows={1}
          style={{
            flex: 1, background: 'transparent', border: 'none', resize: 'none',
            fontSize: '14px', lineHeight: '1.6', color: '#2a273a',
            fontFamily: "'DM Sans', sans-serif",
            overflowY: 'auto', maxHeight: '130px', minHeight: '22px', paddingTop: '1px',
          }}
        />
        <button
          className="send-btn"
          onClick={handleSubmit}
          disabled={disabled || !input.trim()}
          style={{
            width: '36px', height: '36px', borderRadius: '9px', border: 'none',
            background: 'linear-gradient(135deg, #6d4aff, #4f46e5)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {disabled
            ? <span style={{ fontSize: '14px' }}>⏳</span>
            : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
          }
        </button>
      </div>
      <p style={{ fontSize: '11px', color: '#c0bcb4', textAlign: 'center', margin: '8px 0 0' }}>
        Press Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}