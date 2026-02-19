'use client';

import { Message } from './ChatInterface';

interface MessageListProps {
  messages: Message[];
  loading: boolean;
}

export default function MessageList({ messages, loading }: MessageListProps) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes b1 { 0%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-5px); } }
        @keyframes b2 { 0%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-5px); } }
        @keyframes b3 { 0%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-5px); } }
        .d1 { animation: b1 1.2s ease-in-out infinite; }
        .d2 { animation: b2 1.2s ease-in-out 0.15s infinite; }
        .d3 { animation: b3 1.2s ease-in-out 0.3s infinite; }
        .msg { animation: fadeUp 0.22s ease forwards; }
        .prose-content h2 { font-size: 15px; font-weight: 700; color: #1c1a28; margin: 16px 0 6px; font-family: 'Syne', sans-serif; }
        .prose-content h3 { font-size: 13px; font-weight: 600; color: #2a273a; margin: 12px 0 4px; }
        .prose-content p { margin: 0 0 8px; }
        .prose-content strong { font-weight: 600; color: #1c1a28; }
        .prose-content ul, .prose-content ol { margin: 4px 0 8px 18px; padding: 0; }
        .prose-content li { margin-bottom: 3px; }
      `}</style>

      {messages.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '14px', minHeight: '100%' }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '18px',
            background: 'linear-gradient(135deg, #ede9ff, #ddd5ff)',
            border: '1px solid #d5ccff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px',
          }}>✦</div>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: '20px', fontWeight: 700, color: '#1c1a28', margin: '0 0 6px' }}>
              Ready to Evaluate
            </h2>
            <p style={{ fontSize: '14px', color: '#a09d95', margin: 0, maxWidth: '240px' }}>
              Upload a document and ask any question about it
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '6px' }}>
            {['Summarize this proposal', 'Rate the quality', 'List key strengths'].map(s => (
              <div key={s} style={{
                padding: '6px 14px', borderRadius: '100px',
                border: '1px solid #e5e1d8', background: '#fff',
                fontSize: '12px', color: '#7a7670',
              }}>{s}</div>
            ))}
          </div>
        </div>
      ) : (
        messages.map((message) => (
          <div key={message.id} className="msg" style={{ display: 'flex', justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: '8px' }}>

            {/* Assistant avatar */}
            {message.role === 'assistant' && (
              <div style={{
                width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                background: 'linear-gradient(135deg, #6d4aff, #4f46e5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', color: '#fff', marginBottom: '18px',
              }}>✦</div>
            )}

            <div style={{ maxWidth: '68%', minWidth: '60px' }}>
              <div style={{
                padding: '12px 16px',
                borderRadius: message.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: message.role === 'user'
                  ? 'linear-gradient(135deg, #6d4aff, #4f46e5)'
                  : '#ffffff',
                border: message.role === 'user' ? 'none' : '1px solid #e5e1d8',
                boxShadow: message.role === 'user'
                  ? '0 4px 16px rgba(109, 74, 255, 0.2)'
                  : '0 1px 4px rgba(0,0,0,0.04)',
              }}>
                <div
                  className={message.role === 'assistant' ? 'prose-content' : ''}
                  style={{
                    margin: 0, fontSize: '14px', lineHeight: '1.65',
                    color: message.role === 'user' ? '#fff' : '#2a273a',
                    whiteSpace: message.role === 'user' ? 'pre-wrap' : undefined,
                    wordBreak: 'break-word',
                  }}
                  dangerouslySetInnerHTML={message.role === 'assistant' ? {
                    __html: message.content
                      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
                      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
                      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                      .replace(/^- (.+)$/gm, '<li>$1</li>')
                      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
                      .replace(/\n\n/g, '</p><p>')
                      .replace(/^(?!<[hup])(.+)$/gm, '<p>$1</p>')
                  } : undefined}
                >
                  {message.role === 'user' ? message.content : undefined}
                </div>
                {message.metadata?.fileName && (
                  <div style={{
                    marginTop: '8px', paddingTop: '8px',
                    borderTop: `1px solid ${message.role === 'user' ? 'rgba(255,255,255,0.2)' : '#e5e1d8'}`,
                    fontSize: '11px', color: message.role === 'user' ? 'rgba(255,255,255,0.7)' : '#a09d95',
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}>📎 {message.metadata.fileName}</div>
                )}
              </div>
              <p style={{
                fontSize: '10px', color: '#c0bcb4', margin: '4px 0 0',
                textAlign: message.role === 'user' ? 'right' : 'left',
                paddingLeft: message.role === 'assistant' ? '4px' : undefined,
                paddingRight: message.role === 'user' ? '4px' : undefined,
              }}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            {/* User avatar */}
            {message.role === 'user' && (
              <div style={{
                width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                background: '#ede9ff', border: '1px solid #d5ccff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', color: '#6d4aff', fontWeight: 600, marginBottom: '18px',
              }}>N</div>
            )}
          </div>
        ))
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #6d4aff, #4f46e5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#fff',
          }}>✦</div>
          <div style={{
            padding: '14px 18px', borderRadius: '18px 18px 18px 4px',
            background: '#fff', border: '1px solid #e5e1d8',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            display: 'flex', alignItems: 'center', gap: '5px',
          }}>
            <div className="d1" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6d4aff' }} />
            <div className="d2" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6d4aff' }} />
            <div className="d3" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6d4aff' }} />
          </div>
        </div>
      )}
    </div>
  );
}