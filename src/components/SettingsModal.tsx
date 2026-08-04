import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { SRSEngine } from '../services/srsEngine';
import { isModelExhausted } from '../services/geminiGrader';
import { Key, QrCode, Download, Upload, RotateCcw, ExternalLink, Cpu, Brain, CheckCircle, Volume2 } from 'lucide-react';

interface SettingsModalProps {
  onResetRecipes?: () => void;
}

export function SettingsModal({ onResetRecipes }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('gemini_grader_model') || 'gemini-3.5-flash-lite');
  const [thinkingLevel, setThinkingLevel] = useState(() => localStorage.getItem('gemini_thinking_level') || 'HIGH');
  const [ttsEngineMode, setTtsEngineMode] = useState<'web' | 'hybrid'>(() => (localStorage.getItem('tts_engine_mode') as 'web' | 'hybrid') || 'web');
  const [syncString, setSyncString] = useState('');
  const [syncCode, setSyncCode] = useState(() => SRSEngine.getSyncCode() || '');
  
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

  const handleSaveTtsEngineMode = (mode: 'web' | 'hybrid') => {
    setTtsEngineMode(mode);
    localStorage.setItem('tts_engine_mode', mode);
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

  const handleSaveSyncCode = () => {
    const code = syncCode.trim();
    SRSEngine.setSyncCode(code);
    if (code) {
      SRSEngine.pullSync();
      alert(`Auto-Sync enabled with code: ${code}`);
    } else {
      alert('Auto-Sync disabled.');
    }
  };

  const handleManualSync = () => {
    SRSEngine.pushSync();
    SRSEngine.pullSync().then(() => alert('Manual sync triggered!'));
  };

  const handleRevert = () => {
    if (SRSEngine.revertBackup()) {
      alert('Reverted to last local backup!');
      window.location.reload();
    } else {
      alert('No backup found.');
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

      {/* Voice Engine Setting */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--accent-mint)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Volume2 size={18} /> Voice Engine (TTS)
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Choose how the AI reads recipes and feedback aloud.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          {/* Full Web Speech Synthesis */}
          <button
            onClick={() => handleSaveTtsEngineMode('web')}
            style={{
              padding: '0.75rem',
              borderRadius: '8px',
              border: ttsEngineMode === 'web' ? '2px solid var(--accent-mint)' : '1px solid var(--border-subtle)',
              background: ttsEngineMode === 'web' ? 'rgba(5, 150, 105, 0.12)' : 'var(--bg-primary)',
              color: '#FFF',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '0.82rem', color: ttsEngineMode === 'web' ? 'var(--accent-mint)' : '#FFF', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {ttsEngineMode === 'web' && <CheckCircle size={14} style={{ color: 'var(--accent-mint)' }} />} Full Web Speech
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--accent-mint)', fontWeight: 700 }}>
              Default (Zero latency)
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              Instant response, works offline using browser TTS.
            </div>
          </button>

          {/* AI Hybrid */}
          <button
            onClick={() => handleSaveTtsEngineMode('hybrid')}
            style={{
              padding: '0.75rem',
              borderRadius: '8px',
              border: ttsEngineMode === 'hybrid' ? '2px solid var(--accent-mint)' : '1px solid var(--border-subtle)',
              background: ttsEngineMode === 'hybrid' ? 'rgba(5, 150, 105, 0.12)' : 'var(--bg-primary)',
              color: '#FFF',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '0.82rem', color: ttsEngineMode === 'hybrid' ? 'var(--accent-mint)' : '#FFF', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {ttsEngineMode === 'hybrid' && <CheckCircle size={14} style={{ color: 'var(--accent-mint)' }} />} AI Hybrid (Gemini TTS)
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--accent-mint)', fontWeight: 700 }}>
              Natural AI voice
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              Requires API key & network connection.
            </div>
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

      {/* Auto Sync Config */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--accent-mint)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RotateCcw size={18} /> Cloud Auto-Sync
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Sync across devices seamlessly using a 6-character code.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input 
            type="text" 
            value={syncCode} 
            onChange={e => setSyncCode(e.target.value.toUpperCase().slice(0, 6))} 
            placeholder="e.g. SBX999"
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              color: 'white',
              borderRadius: '6px',
              fontFamily: 'monospace',
              fontSize: '1rem',
              textTransform: 'uppercase'
            }}
          />
          <button
            onClick={handleSaveSyncCode}
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
            Save Code
          </button>
        </div>
        
        {SRSEngine.getSyncCode() && (
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{
              background: 'rgba(5, 150, 105, 0.2)',
              color: 'var(--accent-mint)',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 800
            }}>
              Auto-Sync Enabled: {SRSEngine.getSyncCode()}
            </span>
            <button
              onClick={handleManualSync}
              style={{
                background: 'var(--bg-primary)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-subtle)',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem'
              }}
            >
              Auto-Sync Now
            </button>
            <button
              onClick={handleRevert}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#EF4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem'
              }}
            >
              Revert to Local Backup
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
