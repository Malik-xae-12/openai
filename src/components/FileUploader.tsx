'use client';

import { useState, useRef } from 'react';

interface FileUploaderProps {
  onFileUpload: (file: File, preview: string) => void;
  disabled?: boolean;
}

export default function FileUploader({ onFileUpload, disabled }: FileUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    if (disabled) return;
    const supportedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'text/plain',
    ];
    if (!supportedTypes.includes(file.type)) {
      alert('Unsupported file type. Please upload PDF, PPTX, images, or text files.');
      return;
    }
    if (file.type.includes('image')) {
      const reader = new FileReader();
      reader.onload = (e) => { onFileUpload(file, e.target?.result as string); setUploaded(true); };
      reader.readAsDataURL(file);
    } else {
      onFileUpload(file, `📄 ${file.name}`);
      setUploaded(true);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) handleFileSelect(e.dataTransfer.files[0]);
  };

  return (
    <>
      <style>{`
        .uploader { transition: all 0.18s ease; }
        .uploader:hover:not(.disabled) { border-color: #b5a0ff !important; background: #f7f4ff !important; }
        @keyframes checkIn { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .check-anim { animation: checkIn 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      `}</style>

      <div
        className={`uploader${disabled ? ' disabled' : ''}`}
        onDragEnter={handleDrag} onDragLeave={handleDrag}
        onDragOver={handleDrag} onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        style={{
          borderRadius: '12px',
          border: `1.5px dashed ${dragActive ? '#6d4aff' : uploaded ? '#b5a0ff' : '#ddd9d0'}`,
          background: dragActive ? '#f3f0ff' : uploaded ? '#faf8ff' : '#faf9f6',
          padding: '22px 14px', textAlign: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <input
          ref={fileInputRef} type="file"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          disabled={disabled}
          accept=".pdf,.pptx,.jpg,.jpeg,.png,.gif,.webp,.txt"
          style={{ display: 'none' }}
        />

        {uploaded ? (
          <div className="check-anim">
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px',
              background: '#dcfce7', border: '1px solid #bbf7d0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 8px', fontSize: '18px',
            }}>✓</div>
            <p style={{ fontSize: '13px', fontWeight: 500, color: '#16a34a', margin: '0 0 2px' }}>File loaded</p>
            <p style={{ fontSize: '11px', color: '#b5b0a8', margin: 0 }}>Click to replace</p>
          </div>
        ) : (
          <>
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px',
              background: dragActive ? '#ede9ff' : '#f0ecff',
              border: `1px solid ${dragActive ? '#b5a0ff' : '#e0d8ff'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 8px', fontSize: '17px', transition: 'all 0.18s',
            }}>📁</div>
            <p style={{ fontSize: '13px', fontWeight: 500, color: '#7a7670', margin: '0 0 4px' }}>
              {dragActive ? 'Drop to upload' : 'Drop file or click'}
            </p>
            <p style={{ fontSize: '11px', color: '#c0bcb4', margin: 0 }}>PDF · PPTX · Images · Text</p>
          </>
        )}
      </div>
    </>
  );
}