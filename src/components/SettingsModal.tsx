import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { SRSEngine } from '../services/srsEngine';
import { isModelExhausted } from '../services/geminiGrader';
import { Key, QrCode, Download, Upload, RotateCcw, ExternalLink, Cpu, Brain, CheckCircle } from 'lucide-react';

interface SettingsModalProps {
  onResetRecipes?: () => void;
}

export function SettingsModal({ onResetRecipes }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('gemini_grader_model') || 'gemini-3.5-flash-lite');
  const [thinkingLevel, setThinkingLevel] = useState(() => localStorage.getItem('gemini_thinking_level') || 'HIGH');
  const [syncString, setSyncString] = useState('');
  
  const handleSaveKey = () => {
    localStorage.setItem('gemini_api_key', apiKey.trim());
    alert(apiKey.trim() ? 'Gemini API key saved successfully!' : 'API key cleared.');
  };

  const handleSaveModelConfig = (model: string, thinking: string) => {
    setSelectedModel(model);
    setThinkingLevel(thinking);
    localStorage.setItem('gemini_grader_model', model);
    localStorage.setItem('gemini_thinking_level', thinking);
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
          Settings & Model Configuration
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
          Configure AI API keys, Store Manager model selection, reasoning thinking levels, and cross-device sync.
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

      {/* AI Model & Thinking Level Selector */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--accent-mint)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cpu size={18} /> Store Manager Grader Model & Auto-Rotation
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            If a model hits daily free tier limits (HTTP 429), the engine auto-rotates to 3.5 Flash-Lite to ensure continuous practice.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
          {/* Gemini 3.5 Flash-Lite */}
          <button
            onClick={() => handleSaveModelConfig('gemini-3.5-flash-lite', thinkingLevel)}
            style={{
              padding: '0.75rem',
              borderRadius: '8px',
              border: selectedModel === 'gemini-3.5-flash-lite' ? '2px solid var(--accent-mint)' : '1px solid var(--border-subtle)',
              background: selectedModel === 'gemini-3.5-flash-lite' ? 'rgba(5, 150, 105, 0.12)' : 'var(--bg-primary)',
              color: '#FFF',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '0.82rem', color: selectedModel === 'gemini-3.5-flash-lite' ? 'var(--accent-mint)' : '#FFF', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle size={14} style={{ color: 'var(--accent-mint)' }} /> 3.5 Flash-Lite
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--accent-mint)', fontWeight: 700 }}>
              500 drills/day (Recommended)
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              15 RPM limit, sub-second latency, zero quota drops.
            </div>
          </button>

          {/* Gemini 3.5 Flash */}
          <button
            onClick={() => handleSaveModelConfig('gemini-3.5-flash', thinkingLevel)}
            style={{
              padding: '0.75rem',
              borderRadius: '8px',
              border: selectedModel === 'gemini-3.5-flash' ? '2px solid var(--accent-mint)' : '1px solid var(--border-subtle)',
              background: selectedModel === 'gemini-3.5-flash' ? 'rgba(5, 150, 105, 0.12)' : 'var(--bg-primary)',
              color: '#FFF',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              opacity: isModelExhausted('gemini-3.5-flash') ? 0.6 : 1
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '0.82rem', color: selectedModel === 'gemini-3.5-flash' ? 'var(--accent-mint)' : '#FFF' }}>
              3.5 Flash (Fastest 3.9s)
            </div>
            <div style={{ fontSize: '0.7rem', color: isModelExhausted('gemini-3.5-flash') ? '#EF4444' : '#F59E0B', fontWeight: 700 }}>
              {isModelExhausted('gemini-3.5-flash') ? 'Quota Exhausted Today' : '20 drills/day (Capped)'}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              Auto-rotates to 3.5 Flash-Lite when 20 RPD cap hit.
            </div>
          </button>

          {/* Gemini 3.6 Flash */}
          <button
            onClick={() => handleSaveModelConfig('gemini-3.6-flash', thinkingLevel)}
            style={{
              padding: '0.75rem',
              borderRadius: '8px',
              border: selectedModel === 'gemini-3.6-flash' ? '2px solid var(--accent-mint)' : '1px solid var(--border-subtle)',
              background: selectedModel === 'gemini-3.6-flash' ? 'rgba(5, 150, 105, 0.12)' : 'var(--bg-primary)',
              color: '#FFF',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              opacity: isModelExhausted('gemini-3.6-flash') ? 0.6 : 1
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '0.82rem', color: selectedModel === 'gemini-3.6-flash' ? 'var(--accent-mint)' : '#FFF' }}>
              3.6 Flash (Deepest)
            </div>
            <div style={{ fontSize: '0.7rem', color: isModelExhausted('gemini-3.6-flash') ? '#EF4444' : '#F59E0B', fontWeight: 700 }}>
              {isModelExhausted('gemini-3.6-flash') ? 'Quota Exhausted Today' : '20 drills/day (Capped)'}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              Auto-rotates to 3.5 Flash-Lite when 20 RPD cap hit.
            </div>
          </button>
        </div>

        {/* Dynamic Thinking Level Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
          <label style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Brain size={16} style={{ color: 'var(--accent-mint)' }} /> Thinking Level / Reasoning Budget ({selectedModel})
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
            <button
              onClick={() => handleSaveModelConfig(selectedModel, 'OFF')}
              style={{
                padding: '0.65rem 0.75rem',
                borderRadius: '6px',
                border: thinkingLevel === 'OFF' ? '2px solid var(--accent-mint)' : '1px solid var(--border-subtle)',
                background: thinkingLevel === 'OFF' ? 'rgba(5, 150, 105, 0.15)' : 'var(--bg-primary)',
                color: thinkingLevel === 'OFF' ? '#FFF' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              Off (Fastest)
            </button>
            <button
              onClick={() => handleSaveModelConfig(selectedModel, 'LOW')}
              style={{
                padding: '0.65rem 0.75rem',
                borderRadius: '6px',
                border: thinkingLevel === 'LOW' ? '2px solid var(--accent-mint)' : '1px solid var(--border-subtle)',
                background: thinkingLevel === 'LOW' ? 'rgba(5, 150, 105, 0.15)' : 'var(--bg-primary)',
                color: thinkingLevel === 'LOW' ? '#FFF' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              Low (Budget 1024)
            </button>
            <button
              onClick={() => handleSaveModelConfig(selectedModel, 'HIGH')}
              style={{
                padding: '0.65rem 0.75rem',
                borderRadius: '6px',
                border: thinkingLevel === 'HIGH' ? '2px solid var(--accent-mint)' : '1px solid var(--border-subtle)',
                background: thinkingLevel === 'HIGH' ? 'rgba(5, 150, 105, 0.15)' : 'var(--bg-primary)',
                color: thinkingLevel === 'HIGH' ? '#FFF' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              High (Default - Budget 4096)
            </button>
          </div>
        </div>
      </div>

      {/* Reset Recipe Dataset */}
      {onResetRecipes && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#FFF' }}>Reset Recipes to Default Dataset</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Overwrites local recipe state with standard 8 Starbucks training recipes.</div>
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
