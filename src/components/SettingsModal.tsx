import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { SRSEngine } from '../services/srsEngine';
import { Key, QrCode, Download, Upload, RotateCcw, ExternalLink } from 'lucide-react';

interface SettingsModalProps {
  onResetRecipes?: () => void;
}

export function SettingsModal({ onResetRecipes }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [syncString, setSyncString] = useState('');
  
  const handleSaveKey = () => {
    localStorage.setItem('gemini_api_key', apiKey.trim());
    alert(apiKey.trim() ? 'Gemini API key saved successfully!' : 'API key cleared.');
  };

  const handleExport = () => {
    setSyncString(SRSEngine.exportSyncString());
  };

  const handleImport = () => {
    const data = prompt('Paste sync string from another device:');
    if (data) {
      if (SRSEngine.importSyncString(data)) {
        alert('SRS progress imported successfully!');
        window.location.reload();
      } else {
        alert('Invalid sync string format.');
      }
    }
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#FFF' }}>
          Settings & Cross-Device Sync
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
          Configure AI API keys, TTS voice preferences, and sync SRS progress.
        </p>
      </div>

      {/* API Key Configuration */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <label style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--accent-mint)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Key size={16} /> Gemini API Key (AI Store Manager & TTS)
        </label>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
          Get a free API key from{' '}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent-mint)', fontWeight: 700, textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
          >
            Google AI Studio <ExternalLink size={12} />
          </a>{' '}
          and paste it below. Each trainee uses their own key.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input 
            type="password" 
            value={apiKey} 
            onChange={e => setApiKey(e.target.value)} 
            placeholder="Paste your Gemini API key (AIzaSy...)"
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              color: 'white',
              borderRadius: '6px',
              fontFamily: 'monospace',
              fontSize: '0.9rem'
            }}
          />
          <button
            onClick={handleSaveKey}
            style={{
              background: 'var(--accent-mint)',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            Save Key
          </button>
        </div>
      </div>

      {/* Reset Recipe Dataset */}
      {onResetRecipes && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#FFF' }}>Reset Recipes to Standard 6</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Overwrites local recipe state with standard 6 Starbucks training recipes.</div>
          </div>
          <button
            onClick={onResetRecipes}
            style={{
              padding: '0.6rem 1rem',
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              color: 'var(--accent-mint)',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RotateCcw size={14} /> Reset Recipes
          </button>
        </div>
      )}

      {/* Cross Device Sync */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--accent-mint)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <QrCode size={18} /> Cross-Device Sync (PC ↔ Mobile)
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
          Export your SRS progress to another device via QR code or text string.
        </p>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={handleExport}
            style={{
              flex: 1,
              background: 'var(--bg-primary)',
              color: 'var(--text-main)',
              border: '1px solid var(--border-subtle)',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Download size={16} /> Generate QR / Code
          </button>
          <button
            onClick={handleImport}
            style={{
              flex: 1,
              background: 'var(--bg-primary)',
              color: 'var(--text-main)',
              border: '1px solid var(--border-subtle)',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Upload size={16} /> Import Code
          </button>
        </div>
        
        {syncString && (
          <div style={{ marginTop: '1rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
              <QRCodeSVG value={syncString} size={220} />
            </div>
            <textarea 
              readOnly 
              value={syncString} 
              style={{
                width: '100%',
                height: '70px',
                background: 'var(--bg-primary)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-subtle)',
                padding: '0.75rem',
                fontSize: '0.8rem',
                fontFamily: 'monospace',
                borderRadius: '6px',
                resize: 'none'
              }} 
              onClick={e => (e.target as HTMLTextAreaElement).select()} 
            />
          </div>
        )}
      </div>
    </div>
  );
}
