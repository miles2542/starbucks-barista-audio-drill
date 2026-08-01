import { useState, useEffect } from 'react';
import type { Recipe } from '../types/recipe';
import { speakTextGemini, stopSpeech } from '../services/audioEngine';
import { Play, Square, FastForward, Volume2, Coffee } from 'lucide-react';

interface ListenModeProps {
  recipe: Recipe | null;
  recipes: Recipe[];
  onSelectRecipe: (recipe: Recipe) => void;
}

export function ListenMode({ recipe, recipes, onSelectRecipe }: ListenModeProps) {
  const [speed, setSpeed] = useState(1.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);

  const apiKey = localStorage.getItem('gemini_api_key') || '';

  useEffect(() => {
    return () => stopSpeech();
  }, [recipe]);

  const handlePlay = async () => {
    if (!recipe) return;
    setIsPlaying(true);
    
    const text = `${recipe.name}. ${recipe.steps.steamMilk}. ${recipe.steps.queueShots}. ${recipe.steps.pumpSyrup}. ${recipe.steps.finish}.`;

    // Start playing audio with Gemini 3.1 TTS
    const isGeminiAudio = await speakTextGemini(text, apiKey, speed);

    // Visual step sequence highlighting
    setActiveStepIndex(0);
    const durationMultiplier = isGeminiAudio ? 1.0 : 1.0 / speed;
    
    setTimeout(() => setActiveStepIndex(1), 2500 * durationMultiplier);
    setTimeout(() => setActiveStepIndex(2), 5500 * durationMultiplier);
    setTimeout(() => setActiveStepIndex(3), 8500 * durationMultiplier);
    setTimeout(() => {
      setIsPlaying(false);
      setActiveStepIndex(null);
    }, 12000 * durationMultiplier);
  };

  const handleStop = () => {
    stopSpeech();
    setIsPlaying(false);
    setActiveStepIndex(null);
  };

  if (!recipe) return <div className="card" style={{ textAlign: 'center', margin: '2rem auto' }}>Please select a recipe first.</div>;

  const stepsList = [
    { title: '1. Steam Milk', val: recipe.steps.steamMilk },
    { title: '2. Queue Shots', val: recipe.steps.queueShots },
    { title: '3. Add Syrup', val: recipe.steps.pumpSyrup },
    { title: '4. Finish & Connect', val: recipe.steps.finish }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Recipe Picker Carousel */}
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
        {recipes.map(r => (
          <button
            key={r.id}
            onClick={() => onSelectRecipe(r)}
            style={{
              padding: '0.6rem 1rem',
              borderRadius: '8px',
              border: r.id === recipe.id ? '1px solid var(--accent-mint)' : '1px solid var(--border-subtle)',
              background: r.id === recipe.id ? 'rgba(5, 150, 105, 0.15)' : 'var(--bg-surface)',
              color: r.id === recipe.id ? 'var(--accent-mint)' : 'var(--text-muted)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Coffee size={14} />
            {r.name}
          </button>
        ))}
      </div>

      {/* Main Player Card */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-mint)', letterSpacing: '1px', textTransform: 'uppercase' }}>
              GEMINI 3.1 AI READ-ALOUD DRILL
            </span>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '4px 0 0 0', color: '#FFF' }}>
              {recipe.name}
            </h1>
          </div>
          {recipe.code && (
            <span style={{ background: 'var(--border-subtle)', color: 'var(--accent-mint)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'monospace' }}>
              {recipe.code}
            </span>
          )}
        </div>

        {/* Audio Controls */}
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', background: 'var(--bg-primary)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <button
            onClick={handlePlay}
            disabled={isPlaying}
            style={{
              padding: '0.6rem 1.2rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: isPlaying ? 'var(--border-subtle)' : 'var(--accent-mint)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 700,
              cursor: isPlaying ? 'default' : 'pointer'
            }}
          >
            {isPlaying ? <Volume2 size={18} className="spin" /> : <Play size={18} />}
            {isPlaying ? 'Reading AI Voice...' : 'Play Gemini 3.1 TTS'}
          </button>

          <button
            onClick={handleStop}
            disabled={!isPlaying}
            style={{
              padding: '0.6rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              border: '1px solid var(--border-subtle)',
              background: 'transparent',
              color: 'var(--text-main)',
              borderRadius: '6px',
              cursor: isPlaying ? 'pointer' : 'default',
              opacity: isPlaying ? 1 : 0.4
            }}
          >
            <Square size={16} /> Stop
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: 'auto' }}>
            <FastForward size={16} style={{ color: 'var(--text-muted)' }} />
            <select
              value={speed}
              onChange={e => setSpeed(Number(e.target.value))}
              style={{
                background: 'var(--bg-surface)',
                color: 'var(--text-main)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: '0.4rem 0.6rem',
                fontSize: '0.85rem'
              }}
            >
              <option value={0.8}>0.8x</option>
              <option value={1.0}>1.0x</option>
              <option value={1.2}>1.2x</option>
              <option value={1.5}>1.5x</option>
            </select>
          </div>
        </div>

        {/* Recipe Steps Stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {stepsList.map((step, idx) => (
            <div
              key={idx}
              style={{
                padding: '1rem',
                borderRadius: '8px',
                background: 'var(--bg-primary)',
                border: activeStepIndex === idx ? '2px solid var(--accent-mint)' : '1px solid var(--border-subtle)',
                boxShadow: activeStepIndex === idx ? '0 0 12px rgba(5, 150, 105, 0.25)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: activeStepIndex === idx ? 'var(--accent-mint)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {step.title}
              </div>
              <div style={{ fontSize: '0.95rem', color: '#FFF', marginTop: '4px', lineHeight: '1.4' }}>
                {step.val}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
