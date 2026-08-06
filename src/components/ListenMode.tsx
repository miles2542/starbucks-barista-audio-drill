import { useState, useEffect, useMemo } from 'react';
import type { Recipe } from '../types/recipe';
import { speakTextGemini, speakTextWeb, stopSpeech } from '../services/audioEngine';
import { Play, Square, FastForward, Volume2, Coffee, BookOpen, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface ListenModeProps {
  recipe: Recipe | null;
  recipes: Recipe[];
  onSelectRecipe: (recipe: Recipe) => void;
}

export function ListenMode({ recipe, recipes, onSelectRecipe }: ListenModeProps) {
  const [speed, setSpeed] = useState(1.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('All');

  const apiKey = localStorage.getItem('gemini_api_key') || '';
  const ttsEngineMode = localStorage.getItem('tts_engine_mode') || 'web';

  useEffect(() => {
    return () => stopSpeech();
  }, [recipe]);

  const filteredRecipes = useMemo(() => {
    return recipes.filter(r => {
      const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (r.code && r.code.toLowerCase().includes(searchQuery.toLowerCase()));
      if (!matchesSearch) return false;
      
      if (category === 'Hot') return r.type === 'hot';
      if (category === 'Iced') return r.type === 'iced';
      if (category === 'Specialty') return /frappuccino|macchiato|mocha|refresher/i.test(r.name);
      
      return true;
    });
  }, [recipes, searchQuery, category]);

  const currentIdx = recipes.findIndex(r => r.id === recipe?.id);
  
  const handlePrev = () => {
    if (currentIdx > 0) onSelectRecipe(recipes[currentIdx - 1]);
  };
  
  const handleNext = () => {
    if (currentIdx < recipes.length - 1) onSelectRecipe(recipes[currentIdx + 1]);
  };

  const handlePlay = async () => {
    if (!recipe) return;
    setIsPlaying(true);
    
    const text = `${recipe.name}. ${recipe.steps.steamMilk}. ${recipe.steps.queueShots}. ${recipe.steps.pumpSyrup}. ${recipe.steps.finish}.`;

    let isGeminiAudio = false;
    
    // Honor TTS voice engine setting
    if (ttsEngineMode === 'hybrid' && apiKey) {
      isGeminiAudio = await speakTextGemini(text, apiKey, speed);
    } else {
      speakTextWeb(text, speed);
    }

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
      {/* Search and Filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--bg-primary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search recipe by name or code..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem 1rem 0.6rem 2.2rem',
              borderRadius: '6px',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-surface)',
              color: 'var(--text-main)',
              fontSize: '0.9rem',
              boxSizing: 'border-box'
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {['All', 'Hot', 'Iced', 'Specialty'].map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '16px',
                border: category === cat ? '1px solid var(--accent-mint)' : '1px solid var(--border-subtle)',
                background: category === cat ? 'var(--accent-mint)' : 'var(--bg-surface)',
                color: category === cat ? '#FFF' : 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Responsive Grid Selector */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', 
          gap: '0.5rem',
          maxHeight: '200px',
          overflowY: 'auto',
          paddingRight: '0.5rem'
        }}>
          {filteredRecipes.map(r => (
            <button
              key={r.id}
              onClick={() => onSelectRecipe(r)}
              style={{
                padding: '0.6rem',
                borderRadius: '8px',
                border: r.id === recipe?.id ? '1px solid var(--accent-mint)' : '1px solid var(--border-subtle)',
                background: r.id === recipe?.id ? 'rgba(5, 150, 105, 0.15)' : 'var(--bg-surface)',
                color: r.id === recipe?.id ? 'var(--accent-mint)' : 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '4px',
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                <Coffee size={12} style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
              </div>
              <span style={{ 
                fontSize: '0.65rem', 
                padding: '2px 6px', 
                borderRadius: '4px', 
                background: r.type === 'hot' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                color: r.type === 'hot' ? '#ef4444' : '#3b82f6'
              }}>
                {r.type.toUpperCase()}
              </span>
            </button>
          ))}
          {filteredRecipes.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', gridColumn: '1 / -1', padding: '1rem 0' }}>No recipes found.</div>
          )}
        </div>
      </div>

      {/* Main Player Card */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-mint)', letterSpacing: '1px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <BookOpen size={14} /> RECIPE REFERENCE & AUDIO
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '4px 0 0 0' }}>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#FFF', margin: 0 }}>
                {recipe.name}
              </h1>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button 
                  onClick={handlePrev}
                  disabled={currentIdx <= 0}
                  style={{
                    padding: '4px',
                    borderRadius: '4px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: currentIdx <= 0 ? 'var(--text-muted)' : 'var(--text-main)',
                    cursor: currentIdx <= 0 ? 'not-allowed' : 'pointer',
                    opacity: currentIdx <= 0 ? 0.5 : 1
                  }}
                  title="Previous Recipe"
                >
                  <ChevronLeft size={16} />
                </button>
                <button 
                  onClick={handleNext}
                  disabled={currentIdx >= recipes.length - 1}
                  style={{
                    padding: '4px',
                    borderRadius: '4px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: currentIdx >= recipes.length - 1 ? 'var(--text-muted)' : 'var(--text-main)',
                    cursor: currentIdx >= recipes.length - 1 ? 'not-allowed' : 'pointer',
                    opacity: currentIdx >= recipes.length - 1 ? 0.5 : 1
                  }}
                  title="Next Recipe"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
          {recipe.code && (
            <span style={{ background: 'var(--border-subtle)', color: 'var(--accent-mint)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'monospace' }}>
              {recipe.code}
            </span>
          )}
        </div>

        {/* Audio Controls */}
        <div className="flex-col-mobile" style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', background: 'var(--bg-primary)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <button
            onClick={handlePlay}
            disabled={isPlaying}
            style={{
              padding: '0.6rem 1.2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
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
            {isPlaying ? 'Reading Aloud...' : 'Listen to Recipe'}
          </button>

          <button
            onClick={handleStop}
            disabled={!isPlaying}
            style={{
              padding: '0.6rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
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
