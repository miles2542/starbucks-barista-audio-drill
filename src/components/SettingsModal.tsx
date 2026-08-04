import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { SRSEngine } from '../services/srsEngine';
import { isModelExhausted } from '../services/geminiGrader';
import { Key, QrCode, Download, Upload, RotateCcw, Cpu, Brain, CheckCircle, Volume2, Unlink, Loader, AlertTriangle, Info, X, PlusCircle, Link, CloudUpload } from 'lucide-react';

interface SettingsModalProps {
  onResetRecipes?: () => void;
}

interface CustomModalNotice {
  title: string;
  message: string;
  type: 'success' | 'error' | 'info';
  onReload?: boolean;
  showForceUploadButton?: boolean;
}

export function SettingsModal({ onResetRecipes }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('gemini_grader_model') || 'gemini-3.5-flash-lite');
  const [thinkingLevel, setThinkingLevel] = useState(() => localStorage.getItem('gemini_thinking_level') || 'HIGH');
  const [ttsEngineMode, setTtsEngineMode] = useState<'web' | 'hybrid'>(() => (localStorage.getItem('tts_engine_mode') as 'web' | 'hybrid') || 'web');
  const [syncString, setSyncString] = useState('');
  const [syncCode, setSyncCode] = useState(() => SRSEngine.getSyncCode() || '');
  const [modalNotice, setModalNotice] = useState<CustomModalNotice | null>(null);
  const [isConnectingCloud, setIsConnectingCloud] = useState(false);
  
  const handleSaveKey = () => {
    localStorage.setItem('gemini_api_key', apiKey.trim());
    setModalNotice({
      title: 'Gemini API Key',
      message: apiKey.trim() ? 'Gemini API key saved successfully!' : 'API key cleared.',
      type: 'success'
    });
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
    setSyncString(SRSEngine.exportJSON());
  };

  const handleImport = () => {
    const data = prompt('Paste sync string / QR code from another device:');
    if (data) {
      if (SRSEngine.importJSON(data)) {
        setModalNotice({
          title: 'Import Successful',
          message: 'SRS progress imported successfully from JSON snapshot!',
          type: 'success',
          onReload: true
        });
      } else {
        setModalNotice({
          title: 'Import Failed',
          message: 'Invalid sync string format.',
          type: 'error'
        });
      }
    }
  };

  const handleCreateNewChannel = async (forceOverwrite = false) => {
    const code = syncCode.trim().toUpperCase();
    if (!code || code.length < 4) {
      setModalNotice({
        title: 'Invalid Sync Code',
        message: 'Sync code must be at least 4 characters long (e.g. SBX999 or MILES1).',
        type: 'error'
      });
      return;
    }

    setIsConnectingCloud(true);
    const result = await SRSEngine.createNewSyncChannel(code, forceOverwrite);
    setIsConnectingCloud(false);

    if (result.success) {
      setSyncCode(code);
      setModalNotice({
        title: forceOverwrite ? 'Cloud Channel Overwritten & Synced' : 'New Channel Created & Registered',
        message: result.message,
        type: 'success'
      });
    } else {
      setModalNotice({
        title: 'Channel Already Exists',
        message: result.message,
        type: result.codeExists ? 'info' : 'error',
        showForceUploadButton: result.codeExists
      });
    }
  };

  const handleJoinExistingChannel = async () => {
    const code = syncCode.trim().toUpperCase();
    if (!code || code.length < 4) {
      setModalNotice({
        title: 'Invalid Sync Code',
        message: 'Sync code must be at least 4 characters long (e.g. SBX999 or MILES1).',
        type: 'error'
      });
      return;
    }

    setIsConnectingCloud(true);
    const result = await SRSEngine.joinExistingSyncChannel(code);
    setIsConnectingCloud(false);

    if (result.success) {
      setSyncCode(code);
      setModalNotice({
        title: 'Connected & Synced',
        message: result.message,
        type: 'success',
        onReload: true
      });
    } else {
      setModalNotice({
        title: 'Channel Not Found',
        message: result.message,
        type: 'error'
      });
    }
  };

  const handleDisconnectSyncCode = () => {
    SRSEngine.disconnectSyncCode();
    setSyncCode('');
    setModalNotice({
      title: 'Sync Code Disconnected',
      message: 'Auto-sync channel has been disconnected. Your local data remains safe.',
      type: 'info'
    });
  };

  const handleManualSync = async () => {
    setIsConnectingCloud(true);
    await SRSEngine.pushSync();
    await SRSEngine.pullSync();
    setIsConnectingCloud(false);
    setModalNotice({
      title: 'Sync Complete',
      message: `Latest progress synced with cloud channel '${SRSEngine.getSyncCode()}'.`,
      type: 'success'
    });
  };

  const handleRevert = () => {
    if (SRSEngine.revertBackup()) {
      setModalNotice({
        title: 'Reverted Local Backup',
        message: 'Reverted to last local backup snapshot!',
        type: 'success',
        onReload: true
      });
    } else {
      setModalNotice({
        title: 'No Backup Found',
        message: 'No previous local backup snapshot found to revert.',
        type: 'info'
      });
    }
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#FFF' }}>
          App Settings & Configuration
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
          Configure API credentials, model reasoning budget, voice engine, and cross-device sync.
        </p>
      </div>

      {/* Gemini API Key Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--accent-mint)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Key size={18} /> Gemini API Key
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
          Your API key is stored locally in your browser and used only for recipe grading & voice synthesis.
        </p>

        <div className="flex-col-mobile" style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="Paste your Gemini API key (e.g. AIzaSy...)"
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              color: 'white',
              borderRadius: '6px',
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
        <div className="flex-col-mobile" style={{ display: 'flex', gap: '0.75rem' }}>
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
            <div style={{ fontSize: '0.7rem', color: '#F59E0B', fontWeight: 700 }}>
              Ultra Natural AI Voice
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              Uses Gemini 3.1 Flash TTS (requires API key & network).
            </div>
          </button>
        </div>
      </div>

      {/* Model Selection & Thinking Level */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--accent-mint)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Brain size={18} /> Grader Model & Thinking Level
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Select AI model tier. If a model hits daily free tier limits (HTTP 429), the engine auto-rotates to 3.5 Flash-Lite.
          </p>
        </div>

        <div className="flex-col-mobile" style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => handleSaveModelConfig('gemini-3.5-flash-lite', thinkingLevel)}
            style={{
              padding: '0.85rem',
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
            <div style={{ fontWeight: 800, fontSize: '0.85rem', color: selectedModel === 'gemini-3.5-flash-lite' ? 'var(--accent-mint)' : '#FFF', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {selectedModel === 'gemini-3.5-flash-lite' && <CheckCircle size={14} style={{ color: 'var(--accent-mint)' }} />} 3.5 Flash-Lite
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--accent-mint)', fontWeight: 700 }}>
              500 drills/day (Recommended)
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              15 RPM limit, sub-second latency, zero quota drops.
            </div>
          </button>

          <button
            onClick={() => handleSaveModelConfig('gemini-3.5-flash', thinkingLevel)}
            style={{
              padding: '0.85rem',
              borderRadius: '8px',
              border: selectedModel === 'gemini-3.5-flash' ? '2px solid var(--accent-mint)' : '1px solid var(--border-subtle)',
              background: selectedModel === 'gemini-3.5-flash' ? 'rgba(5, 150, 105, 0.12)' : 'var(--bg-primary)',
              color: '#FFF',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '0.85rem', color: selectedModel === 'gemini-3.5-flash' ? 'var(--accent-mint)' : '#FFF', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {selectedModel === 'gemini-3.5-flash' && <CheckCircle size={14} style={{ color: 'var(--accent-mint)' }} />} 3.5 Flash (Fastest 3.9s)
            </div>
            <div style={{ fontSize: '0.7rem', color: '#F59E0B', fontWeight: 700 }}>
              20 drills/day (Capped)
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              {isModelExhausted('gemini-3.5-flash') ? 'Quota exhausted today. Auto-rotated to Lite.' : 'Auto-rotates to 3.5 Flash-Lite when 20 RPD cap hit.'}
            </div>
          </button>

          <button
            onClick={() => handleSaveModelConfig('gemini-3.6-flash', thinkingLevel)}
            style={{
              padding: '0.85rem',
              borderRadius: '8px',
              border: selectedModel === 'gemini-3.6-flash' ? '2px solid var(--accent-mint)' : '1px solid var(--border-subtle)',
              background: selectedModel === 'gemini-3.6-flash' ? 'rgba(5, 150, 105, 0.12)' : 'var(--bg-primary)',
              color: '#FFF',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '0.85rem', color: selectedModel === 'gemini-3.6-flash' ? 'var(--accent-mint)' : '#FFF', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {selectedModel === 'gemini-3.6-flash' && <CheckCircle size={14} style={{ color: 'var(--accent-mint)' }} />} 3.6 Flash (Deepest)
            </div>
            <div style={{ fontSize: '0.7rem', color: '#F59E0B', fontWeight: 700 }}>
              20 drills/day (Capped)
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              {isModelExhausted('gemini-3.6-flash') ? 'Quota exhausted today. Auto-rotated to Lite.' : 'Auto-rotates to 3.5 Flash-Lite when 20 RPD cap hit.'}
            </div>
          </button>
        </div>

        {/* Reasoning Thinking Budget */}
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Cpu size={14} /> Thinking Level / Reasoning Budget ({selectedModel})
          </div>
          <div className="flex-col-mobile" style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => handleSaveModelConfig(selectedModel, 'OFF')}
              style={{
                padding: '0.5rem',
                borderRadius: '6px',
                border: thinkingLevel === 'OFF' ? '1px solid var(--accent-mint)' : '1px solid var(--border-subtle)',
                background: thinkingLevel === 'OFF' ? 'var(--accent-mint)' : 'var(--bg-primary)',
                color: 'white',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Off (Fastest)
            </button>
            <button
              onClick={() => handleSaveModelConfig(selectedModel, 'LOW')}
              style={{
                padding: '0.5rem',
                borderRadius: '6px',
                border: thinkingLevel === 'LOW' ? '1px solid var(--accent-mint)' : '1px solid var(--border-subtle)',
                background: thinkingLevel === 'LOW' ? 'var(--accent-mint)' : 'var(--bg-primary)',
                color: 'white',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Low (Budget 1024)
            </button>
            <button
              onClick={() => handleSaveModelConfig(selectedModel, 'HIGH')}
              style={{
                padding: '0.5rem',
                borderRadius: '6px',
                border: thinkingLevel === 'HIGH' ? '1px solid var(--accent-mint)' : '1px solid var(--border-subtle)',
                background: thinkingLevel === 'HIGH' ? 'var(--accent-mint)' : 'var(--bg-primary)',
                color: 'white',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              High (Default - Budget 4096)
            </button>
          </div>
        </div>
      </div>

      {/* Manual Reset Recipes Section */}
      {onResetRecipes && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#FFF' }}>
              Reset Recipes to Default Dataset
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Overwrites local recipe state with standard 13 Starbucks training recipes.
            </p>
          </div>
          <button
            onClick={onResetRecipes}
            style={{
              background: 'transparent',
              color: 'var(--status-fail)',
              border: '1px solid var(--status-fail)',
              padding: '0.65rem 1.25rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RotateCcw size={16} /> Reset Recipes
          </button>
        </div>
      )}

      {/* Manual Snapshot Export / Import */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--accent-mint)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <QrCode size={18} /> Manual Snapshot Sync (PC ↔ Mobile)
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Export your SRS progress to another device via QR code or text string.
          </p>
        </div>

        <div className="flex-col-mobile" style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            onClick={handleExport}
            style={{
              padding: '0.75rem',
              background: 'var(--bg-primary)',
              color: 'white',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Download size={16} /> Generate QR / Code
          </button>

          <button 
            onClick={handleImport}
            style={{
              padding: '0.75rem',
              background: 'var(--bg-primary)',
              color: 'white',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
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

      {/* Cloud Auto-Sync Configuration */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--accent-mint)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RotateCcw size={18} /> Cloud Auto-Sync
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Create a new sync channel on your primary device, or join an existing channel from another device.
          </p>
        </div>

        {/* Sync Code Input & Code Generator */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input 
            type="text" 
            value={syncCode} 
            onChange={e => setSyncCode(e.target.value.toUpperCase().slice(0, 8))} 
            placeholder="E.G. SBX999"
            disabled={isConnectingCloud}
            style={{
              flex: 1,
              minWidth: '140px',
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
            onClick={() => {
              const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
              let rnd = '';
              for (let i = 0; i < 6; i++) {
                rnd += chars.charAt(Math.floor(Math.random() * chars.length));
              }
              setSyncCode(rnd);
            }}
            disabled={isConnectingCloud}
            style={{
              background: 'var(--bg-primary)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-subtle)',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              cursor: isConnectingCloud ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '0.82rem'
            }}
          >
            Generate Random Code
          </button>
        </div>

        {/* Explicit Action Buttons: Create New vs Join Existing */}
        <div className="flex-col-mobile" style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => handleCreateNewChannel(false)}
            disabled={isConnectingCloud}
            style={{
              background: 'var(--accent-mint)',
              color: 'white',
              border: 'none',
              padding: '0.8rem 1rem',
              borderRadius: '6px',
              cursor: isConnectingCloud ? 'not-allowed' : 'pointer',
              fontWeight: 700,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            {isConnectingCloud ? <Loader size={16} className="spin-animation" /> : <><PlusCircle size={16} /> Create New Channel</>}
          </button>

          <button
            onClick={handleJoinExistingChannel}
            disabled={isConnectingCloud}
            style={{
              background: 'var(--bg-primary)',
              color: '#FFF',
              border: '1px solid var(--accent-mint)',
              padding: '0.8rem 1rem',
              borderRadius: '6px',
              cursor: isConnectingCloud ? 'not-allowed' : 'pointer',
              fontWeight: 700,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            {isConnectingCloud ? <Loader size={16} className="spin-animation" /> : <><Link size={16} /> Join Existing Channel</>}
          </button>
        </div>

        {SRSEngine.getSyncCode() && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', background: 'rgba(5, 150, 105, 0.08)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid rgba(5, 150, 105, 0.25)', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
              <CheckCircle size={18} style={{ color: 'var(--accent-mint)', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#FFF' }}>
                  Auto-Sync Active: <span style={{ color: 'var(--accent-mint)', fontFamily: 'monospace' }}>{SRSEngine.getSyncCode()}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Auto-syncs in background on drill complete or app focus.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleManualSync}
                disabled={isConnectingCloud}
                style={{
                  background: 'var(--bg-primary)',
                  color: 'white',
                  border: '1px solid var(--border-subtle)',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Sync Now
              </button>
              
              <button
                onClick={handleDisconnectSyncCode}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: 'var(--status-fail)',
                  border: '1px solid var(--status-fail)',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Unlink size={14} /> Disconnect Code
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
          <button
            onClick={handleRevert}
            style={{
              background: 'transparent',
              color: 'var(--text-muted)',
              border: 'none',
              fontSize: '0.75rem',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Revert to Local Backup Snapshot
          </button>
        </div>
      </div>

      {/* Custom Modal Notice Dialog */}
      {modalNotice && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '1rem'
        }}>
          <div className="card" style={{ maxWidth: '440px', width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: `4px solid ${modalNotice.type === 'error' ? 'var(--status-fail)' : modalNotice.type === 'success' ? 'var(--accent-mint)' : '#3B82F6'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {modalNotice.type === 'error' ? (
                  <AlertTriangle size={22} style={{ color: 'var(--status-fail)' }} />
                ) : modalNotice.type === 'success' ? (
                  <CheckCircle size={22} style={{ color: 'var(--accent-mint)' }} />
                ) : (
                  <Info size={22} style={{ color: '#3B82F6' }} />
                )}
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#FFF' }}>
                  {modalNotice.title}
                </h3>
              </div>
              <button
                onClick={() => {
                  const reload = modalNotice.onReload;
                  setModalNotice(null);
                  if (reload) window.location.reload();
                }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', margin: 0, lineHeight: '1.5' }}>
              {modalNotice.message}
            </p>

            {modalNotice.showForceUploadButton && (
              <button
                onClick={() => {
                  setModalNotice(null);
                  handleCreateNewChannel(true);
                }}
                style={{
                  padding: '0.75rem 1rem',
                  background: 'var(--accent-mint)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <CloudUpload size={16} /> Upload & Overwrite Cloud with Local Progress
              </button>
            )}

            <button
              onClick={() => {
                const reload = modalNotice.onReload;
                setModalNotice(null);
                if (reload) window.location.reload();
              }}
              style={{
                marginTop: modalNotice.showForceUploadButton ? '0' : '0.5rem',
                padding: '0.65rem 1.25rem',
                background: modalNotice.type === 'error' ? 'var(--status-fail)' : modalNotice.type === 'success' ? 'var(--accent-mint)' : 'var(--bg-primary)',
                color: 'white',
                border: modalNotice.showForceUploadButton ? '1px solid var(--border-subtle)' : 'none',
                borderRadius: '6px',
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              {modalNotice.showForceUploadButton ? 'Cancel' : 'OK'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
