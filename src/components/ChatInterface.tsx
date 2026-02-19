'use client';

import { useState, useRef, useEffect } from 'react';
import FileUploader from './FileUploader';
import MessageList from './MessageList';
import ChatInput from './ChatInput';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: { fileName?: string; scores?: Record<string, number> };
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileUpload = (file: File, preview: string) => {
    if (loading) return;

    setUploadedFile(file);
    setFilePreview(preview);
    setMessages(prev => [...prev, {
      id: Date.now().toString(), role: 'user',
      content: `📄 Uploaded: ${file.name}`,
      timestamp: new Date(), metadata: { fileName: file.name },
    }]);

    void handleSendMessage('', file);
  };

  const handleSendMessage = async (text: string, fileOverride?: File | null) => {
    const activeFile = fileOverride ?? uploadedFile;
    if (!text.trim() && !activeFile) return;
    setMessages(prev => [...prev, {
      id: Date.now().toString(), role: 'user',
      content: text || 'Please evaluate the uploaded document',
      timestamp: new Date(),
    }]);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('message', text || 'evaluate');
      if (activeFile) formData.append('file', activeFile);
      const response = await fetch('/api/chat', { method: 'POST', body: formData });
      if (!response.ok) throw new Error(`API error: ${response.statusText}`);
      const data = await response.json();
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), role: 'assistant',
        content: data.output || data.message || 'No response received',
        timestamp: new Date(), metadata: data.metadata,
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f5f4f0', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=Syne:wght@600;700;800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d5d0c8; border-radius: 2px; }
      `}</style>

      {/* Header */}
      <header style={{
        borderBottom: '1px solid #e5e1d8', background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(12px)', padding: '0 24px', height: '60px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '9px',
            background: 'linear-gradient(135deg, #6d4aff, #4f46e5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', color: '#fff', fontWeight: 700,
          }}>✦</div>
          <div>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '15px', fontWeight: 700, color: '#1c1a28', margin: 0, letterSpacing: '-0.2px' }}>
              Proposal Evaluator
            </h1>
            <p style={{ fontSize: '11px', color: '#a09d95', margin: 0 }}>Powered by OpenAI Agents</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e80' }} />
          <span style={{ fontSize: '12px', color: '#a09d95' }}>Live</span>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <aside style={{
          width: '256px', flexShrink: 0,
          borderRight: '1px solid #e5e1d8', background: '#ffffff',
          display: 'flex', flexDirection: 'column', padding: '20px 14px',
          gap: '18px', overflowY: 'auto',
        }}>
          <div>
            <p style={{ fontSize: '10px', fontWeight: 600, color: '#b5b0a8', letterSpacing: '1.4px', textTransform: 'uppercase', margin: '0 0 10px' }}>
              Document
            </p>
            <FileUploader onFileUpload={handleFileUpload} disabled={loading} />
          </div>

          {filePreview && (
            <div>
              <p style={{ fontSize: '10px', fontWeight: 600, color: '#b5b0a8', letterSpacing: '1.4px', textTransform: 'uppercase', margin: '0 0 10px' }}>
                Loaded
              </p>
              <div style={{ borderRadius: '10px', border: '1px solid #eceae4', background: '#faf9f6', padding: '11px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#ede9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                  {uploadedFile?.type.includes('image') ? '🖼️' : '📄'}
                </div>
                <div style={{ minWidth: 0 }}>
                  {uploadedFile?.type.includes('image')
                    ? <img src={filePreview} alt="preview" style={{ width: '100%', borderRadius: '6px' }} />
                    : <>
                        <p style={{ fontSize: '12px', color: '#2a273a', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{uploadedFile?.name}</p>
                        <p style={{ fontSize: '11px', color: '#b5b0a8', margin: 0 }}>{(uploadedFile!.size / 1024 / 1024).toFixed(2)} MB</p>
                      </>
                  }
                </div>
              </div>
            </div>
          )}

          <div style={{ marginTop: 'auto' }}>
            <div style={{ borderRadius: '10px', border: '1px solid #eceae4', background: '#faf9f6', padding: '14px' }}>
              <p style={{ fontSize: '11px', color: '#b5b0a8', margin: '0 0 4px' }}>Session</p>
              <p style={{ fontSize: '26px', fontWeight: 700, color: '#6d4aff', margin: '0 0 2px', fontFamily: "'Syne', sans-serif", lineHeight: 1 }}>
                {messages.filter(m => m.role === 'user').length}
              </p>
              <p style={{ fontSize: '11px', color: '#b5b0a8', margin: 0 }}>messages sent</p>
            </div>
          </div>
        </aside>

        {/* Chat */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f7f5f1' }}>
          <MessageList messages={messages} loading={loading} />
          <div ref={messagesEndRef} />
          <ChatInput onSendMessage={handleSendMessage} disabled={loading} />
        </main>
      </div>
    </div>
  );
}