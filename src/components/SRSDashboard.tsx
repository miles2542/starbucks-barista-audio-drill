import { useState, useEffect } from 'react';
import type { Recipe } from '../types/recipe';
import { SRSEngine, type WeightData } from '../services/srsEngine';
import { HistoryEngine, type RecitationLog } from '../services/historyEngine';
import type { EvaluationDebugLog } from '../services/geminiGrader';
import { Activity, Award, Zap, ShieldCheck, ArrowUpDown, History, Play, Terminal, XCircle, Info } from 'lucide-react';

function FormattedFeedbackText({ text, pass }: { text: string; pass: boolean }) {
  if (!text) return null;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.92rem', lineHeight: '1.5' }}>
      {lines.map((line, idx) => {
        if (line.startsWith('**FAIL:') || line.startsWith('**PASS:')) {
          const cleanHeader = line.replace(/\*\*/g, '');
          return (
            <div key={idx} style={{ fontWeight: 800, fontSize: '1rem', color: pass ? 'var(--accent-mint)' : 'var(--status-fail)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
              {cleanHeader}
            </div>
          );
        }
        if (line.startsWith('* ') || line.startsWith('- ')) {
          const cleanLine = line.replace(/^[\*\-]\s+/, '');
          const parts = cleanLine.split(/(\*\*.*?\*\*)/g);
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', paddingLeft: '4px' }}>
              <span style={{ color: pass ? 'var(--accent-mint)' : 'var(--status-fail)', fontWeight: 800 }}>•</span>
              <div>
                {parts.map((p, pIdx) => {
                  if (p.startsWith('**') && p.endsWith('**')) {
                    return <strong key={pIdx} style={{ color: '#FFF' }}>{p.replace(/\*\*/g, '')}</strong>;
                  }
                  return <span key={pIdx} style={{ color: 'var(--text-main)' }}>{p}</span>;
                })}
              </div>
            </div>
          );
        }
        if (line.startsWith('**') && line.endsWith('**')) {
          return (
            <div key={idx} style={{ fontWeight: 700, color: 'var(--text-muted)', marginTop: '0.25rem', fontSize: '0.82rem', letterSpacing: '0.5px' }}>
              {line.replace(/\*\*/g, '')}
            </div>
          );
        }
        const numMatch = line.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', paddingLeft: '8px', color: 'var(--text-main)' }}>
              <span style={{ fontWeight: 700, color: 'var(--accent-mint)', minWidth: '18px' }}>{numMatch[1]}.</span>
              <span>{numMatch[2]}</span>
            </div>
          );
        }
        return (
          <div key={idx} style={{ color: 'var(--text-main)' }}>
            {line}
          </div>
        );
      })}
    </div>
  );
}

interface SRSDashboardProps {
  recipes: Recipe[];
}

interface RecipeItemMetrics {
  recipe: Recipe;
  displayName: string;
  code: string;
  type: 'hot' | 'iced';
  totalCorrect: number;
  totalIncorrect: number;
  totalReviews: number;
  passRate: number;            // 0 - 100%
  weight: number;              // Individual selection weight
  confidenceScore: number;     // 0 - 100% calculated confidence rating
  masteryStatus: 'Mastered' | 'Learning' | 'Needs Practice';
  lastTimestamp?: number;
  avgSpeedMs?: number;
  groupBaseKey: string;        // Base key to group hot & iced variations side-by-side
}

export function SRSDashboard({ recipes }: SRSDashboardProps) {
  const [filterStatus, setFilterStatus] = useState<'all' | 'mastered' | 'learning' | 'practice' | 'all-history'>('all');
  const [sortBy, setSortBy] = useState<'grouped' | 'weight-desc' | 'confidence-asc' | 'reviews-desc' | 'name-asc'>('grouped');

  const [historyLogs, setHistoryLogs] = useState<RecitationLog[]>([]);
  const [historySort, setHistorySort] = useState<'newest' | 'oldest'>('newest');
  const [historyResultFilter, setHistoryResultFilter] = useState<'all' | 'pass' | 'fail'>('all');
  const [selectedRecipeHistoryId, setSelectedRecipeHistoryId] = useState<string | null>(null);
  const [debugLogModal, setDebugLogModal] = useState<EvaluationDebugLog | null>(null);
  const [toastNotification, setToastNotification] = useState<string | null>(null);
  
  const [disabledIds, setDisabledIds] = useState<Set<string>>(new Set(SRSEngine.getDisabledRecipeIds()));

  useEffect(() => {
    setHistoryLogs(HistoryEngine.getAllLogs());
    
    const handleSyncUpdate = () => {
      setDisabledIds(new Set(SRSEngine.getDisabledRecipeIds()));
    };
    window.addEventListener('starbucks_srs_sync_updated', handleSyncUpdate);
    return () => {
      window.removeEventListener('starbucks_srs_sync_updated', handleSyncUpdate);
    };
  }, []);

  const handleToggleRecipe = (id: string) => {
    SRSEngine.toggleRecipeDisabled(id);
    setDisabledIds(new Set(SRSEngine.getDisabledRecipeIds()));
  };

  const handleSelectAll = () => {
    SRSEngine.setDisabledRecipeIds([]);
    setDisabledIds(new Set());
    if (SRSEngine.getSyncCode()) SRSEngine.pushSync();
  };

  const handleDeselectAll = () => {
    const allIds = recipes.map(r => r.id);
    SRSEngine.setDisabledRecipeIds(allIds);
    setDisabledIds(new Set(allIds));
    if (SRSEngine.getSyncCode()) SRSEngine.pushSync();
  };

  const refreshLogs = () => {
    setHistoryLogs(HistoryEngine.getAllLogs());
  };

  const playAudio = async (audioId: string | undefined) => {
    if (!audioId) {
      alert("No audio recorded for this drill.");
      return;
    }
    const blob = await HistoryEngine.getAudioBlob(audioId);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
    } else {
      alert("Audio blob not found.");
    }
  };

  const handleRevertGrade = (log: RecitationLog) => {
    const allIds = recipes.map(r => r.id);
    SRSEngine.revertAndReGrade(log.recipeId, !log.pass, allIds);
    HistoryEngine.updateLogGrade(log.id, !log.pass);
    refreshLogs();
    setToastNotification(`Grade corrected to ${!log.pass ? 'PASS' : 'FAIL'}`);
    setTimeout(() => setToastNotification(null), 3000);
  };

  const srsData = SRSEngine.loadAll();

  // Map every individual recipe to its own distinct SRS metrics item
  const getItemMetrics = (): RecipeItemMetrics[] => {
    return recipes.map(r => {
      const data: WeightData = srsData[r.id] || {
        id: r.id,
        weight: 100,
        correctCount: 0,
        incorrectCount: 0,
        turnsSinceLastGraded: 0
      };

      const totalCorrect = data.correctCount || 0;
      const totalIncorrect = data.incorrectCount || 0;
      const totalReviews = totalCorrect + totalIncorrect;
      const passRate = totalReviews > 0 ? Math.round((totalCorrect / totalReviews) * 100) : 0;
      const weight = data.weight || 100;

      // Confidence Score % formula based on SM-2 weight range (15 to 250)
      const weightPenalty = Math.min(100, Math.max(0, ((weight - 15) / 235) * 100));
      let confidenceScore = Math.round(100 - weightPenalty);
      if (totalReviews === 0) confidenceScore = 50;

      let masteryStatus: 'Mastered' | 'Learning' | 'Needs Practice' = 'Learning';
      if (weight <= 35 && totalReviews >= 2) {
        masteryStatus = 'Mastered';
      } else if (weight >= 110 || (totalReviews > 0 && passRate < 60)) {
        masteryStatus = 'Needs Practice';
      }

      // Base key for visual side-by-side grouping (e.g. "latte", "cappuccino", "macchiato")
      let baseKey = r.name.replace(/^(Hot|Iced)\s+/i, '').split('(')[0].trim().toLowerCase();

      return {
        recipe: r,
        displayName: r.name,
        code: r.code || '',
        type: r.type,
        totalCorrect,
        totalIncorrect,
        totalReviews,
        passRate,
        weight,
        confidenceScore,
        masteryStatus,
        lastTimestamp: data.lastGradedTimestamp || undefined,
        avgSpeedMs: data.lastSpeedMs || undefined,
        groupBaseKey: baseKey
      };
    });
  };

  const items = getItemMetrics();

  // Filter
  const filteredItems = items.filter(g => {
    if (filterStatus === 'mastered') return g.masteryStatus === 'Mastered';
    if (filterStatus === 'learning') return g.masteryStatus === 'Learning';
    if (filterStatus === 'practice') return g.masteryStatus === 'Needs Practice';
    if (filterStatus === 'all-history') return false;
    return true;
  });

  // Sort
  filteredItems.sort((a, b) => {
    if (sortBy === 'grouped') {
      // Group related hot & iced recipes side-by-side, hot first then iced
      const groupComp = a.groupBaseKey.localeCompare(b.groupBaseKey);
      if (groupComp !== 0) return groupComp;
      return a.type === 'hot' ? -1 : 1;
    }
    if (sortBy === 'weight-desc') return b.weight - a.weight;
    if (sortBy === 'confidence-asc') return a.confidenceScore - b.confidenceScore;
    if (sortBy === 'reviews-desc') return b.totalReviews - a.totalReviews;
    if (sortBy === 'name-asc') return a.displayName.localeCompare(b.displayName);
    return 0;
  });

  // Global Overview Statistics
  const totalMastered = items.filter(g => g.masteryStatus === 'Mastered').length;
  const globalReviews = items.reduce((acc, g) => acc + g.totalReviews, 0);
  const globalCorrect = items.reduce((acc, g) => acc + g.totalCorrect, 0);
  const globalAccuracy = globalReviews > 0 ? Math.round((globalCorrect / globalReviews) * 100) : 0;
  const globalConfidence = Math.round(items.reduce((acc, g) => acc + g.confidenceScore, 0) / (items.length || 1));

  const formatRelativeTime = (ts?: number) => {
    if (!ts) return 'Not drilled yet';
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header Title & Bulk Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-mint)', letterSpacing: '1px', textTransform: 'uppercase' }}>
            SRS MEMORY METRICS & ANALYTICS
          </span>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '4px 0 0 0', color: '#FFF' }}>
            Recipe SRS Dashboard
          </h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ 
            padding: '0.5rem 0.85rem', 
            background: 'rgba(5, 150, 105, 0.15)', 
            border: '1px solid var(--accent-mint)', 
            borderRadius: '6px', 
            color: 'var(--accent-mint)', 
            fontWeight: 800, 
            fontSize: '0.85rem' 
          }}>
            Active Drill Pool: {recipes.length - disabledIds.size} / {recipes.length}
          </div>
          <button
            onClick={handleSelectAll}
            style={{ padding: '0.5rem 0.85rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
          >
            Select All
          </button>
          <button
            onClick={handleDeselectAll}
            style={{ padding: '0.5rem 0.85rem', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* Global Analytics Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
        
        {/* Global Mastery Rate */}
        <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Award size={14} style={{ color: 'var(--accent-mint)' }} /> MASTERED
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#FFF' }}>
            {totalMastered} / {items.length}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--accent-mint)' }}>
            {Math.round((totalMastered / (items.length || 1)) * 100)}% Recipes Mastered
          </div>
        </div>

        {/* Global Recall Confidence */}
        <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ShieldCheck size={14} style={{ color: 'var(--accent-mint)' }} /> CONFIDENCE
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-mint)' }}>
            {globalConfidence}%
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            SuperMemo SM-2 Score
          </div>
        </div>

        {/* Total Drill Reviews */}
        <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Activity size={14} style={{ color: '#3B82F6' }} /> DRILL ENCOUNTERS
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#FFF' }}>
            {globalReviews}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Total Lifetime Reviews
          </div>
        </div>

        {/* Overall Accuracy */}
        <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Zap size={14} style={{ color: '#F59E0B' }} /> RECALL ACCURACY
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: globalAccuracy >= 80 ? 'var(--accent-mint)' : '#F59E0B' }}>
            {globalAccuracy}%
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Pass / Fail Ratio
          </div>
        </div>

      </div>

      {/* Filter and Sort Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        
        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', background: 'var(--bg-primary)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <button
            onClick={() => setFilterStatus('all')}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              border: 'none',
              background: filterStatus === 'all' ? 'var(--bg-surface)' : 'transparent',
              color: filterStatus === 'all' ? '#FFF' : 'var(--text-muted)',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            All ({items.length})
          </button>
          <button
            onClick={() => setFilterStatus('mastered')}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              border: 'none',
              background: filterStatus === 'mastered' ? 'rgba(5, 150, 105, 0.2)' : 'transparent',
              color: filterStatus === 'mastered' ? 'var(--accent-mint)' : 'var(--text-muted)',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Mastered ({totalMastered})
          </button>
          <button
            onClick={() => setFilterStatus('practice')}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              border: 'none',
              background: filterStatus === 'practice' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
              color: filterStatus === 'practice' ? 'var(--status-fail)' : 'var(--text-muted)',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Needs Practice ({items.filter(g => g.masteryStatus === 'Needs Practice').length})
          </button>
          <button
            onClick={() => setFilterStatus('all-history')}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              border: 'none',
              background: filterStatus === 'all-history' ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
              color: filterStatus === 'all-history' ? '#8B5CF6' : 'var(--text-muted)',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            All History ({historyLogs.length})
          </button>
        </div>

        {/* Sort Selector */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', maxWidth: '100%' }}>
          <ArrowUpDown size={14} style={{ color: 'var(--text-muted)' }} />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            style={{
              background: 'var(--bg-primary)',
              color: '#FFF',
              border: '1px solid var(--border-subtle)',
              padding: '0.4rem 0.75rem',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              maxWidth: '100%'
            }}
          >
            <option value="grouped">Sort: Cohesive Drink Grouping (Hot/Iced Adjacent)</option>
            <option value="weight-desc">Sort: Priority Weight (High to Low)</option>
            <option value="confidence-asc">Sort: Confidence (Lowest First)</option>
            <option value="reviews-desc">Sort: Most Practiced</option>
            <option value="name-asc">Sort: Recipe Name (A-Z)</option>
          </select>
        </div>

      </div>

      {/* Individual Recipe SRS Table */}
      <div className="card srs-table-container hidden-mobile" style={{ padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ padding: '0.85rem 1rem' }}>Active</th>
                <th style={{ padding: '0.85rem 1rem' }}>Recipe Name</th>
                <th style={{ padding: '0.85rem 1rem' }}>Type</th>
                <th style={{ padding: '0.85rem 1rem' }}>SRS Weight</th>
                <th style={{ padding: '0.85rem 1rem' }}>Confidence Meter</th>
                <th style={{ padding: '0.85rem 1rem' }}>Accuracy</th>
                <th style={{ padding: '0.85rem 1rem' }}>Last Drilled</th>
                <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                <th style={{ padding: '0.85rem 1rem' }}>History</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(g => (
                <tr key={g.recipe.id} style={{ borderBottom: '1px solid var(--border-subtle)', opacity: disabledIds.has(g.recipe.id) ? 0.65 : 1 }}>
                  
                  {/* Active Toggle */}
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <input
                      type="checkbox"
                      checked={!disabledIds.has(g.recipe.id)}
                      onChange={() => handleToggleRecipe(g.recipe.id)}
                      style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: 'var(--accent-mint)' }}
                    />
                  </td>

                  {/* Drink Name */}
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#FFF' }}>
                    {g.displayName}
                  </td>

                  {/* Hot / Iced Badge */}
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        background: g.type === 'hot' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        color: g.type === 'hot' ? '#EF4444' : '#3B82F6',
                        border: `1px solid ${g.type === 'hot' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`
                      }}
                    >
                      {g.type.toUpperCase()}
                    </span>
                  </td>

                  {/* Weight Score */}
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'monospace' }}>
                    {Math.round(g.weight)}
                  </td>

                  {/* Confidence Bar */}
                  <td style={{ padding: '0.85rem 1rem', width: '160px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 700 }}>
                        <span style={{ color: g.confidenceScore >= 75 ? 'var(--accent-mint)' : g.confidenceScore >= 50 ? '#F59E0B' : 'var(--status-fail)' }}>
                          {g.confidenceScore}%
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>{g.totalReviews} reviews</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'var(--bg-primary)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${g.confidenceScore}%`,
                            height: '100%',
                            background: g.confidenceScore >= 75 ? 'var(--accent-mint)' : g.confidenceScore >= 50 ? '#F59E0B' : 'var(--status-fail)',
                            borderRadius: '3px',
                            transition: 'width 0.3s ease'
                          }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Accuracy */}
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: g.passRate >= 80 ? 'var(--accent-mint)' : '#FFF' }}>
                    {g.totalReviews > 0 ? `${g.passRate}% (${g.totalCorrect}/${g.totalReviews})` : '—'}
                  </td>

                  {/* Last Drilled Timestamp */}
                  <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {formatRelativeTime(g.lastTimestamp)}
                  </td>

                  {/* Status Badge */}
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        background: g.masteryStatus === 'Mastered' ? 'rgba(5, 150, 105, 0.15)' : g.masteryStatus === 'Learning' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: g.masteryStatus === 'Mastered' ? 'var(--accent-mint)' : g.masteryStatus === 'Learning' ? '#3B82F6' : 'var(--status-fail)',
                        border: `1px solid ${g.masteryStatus === 'Mastered' ? 'var(--accent-mint)' : g.masteryStatus === 'Learning' ? '#3B82F6' : 'var(--status-fail)'}`
                      }}
                    >
                      {g.masteryStatus}
                    </span>
                  </td>

                  {/* History Button */}
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <button
                      onClick={() => setSelectedRecipeHistoryId(g.recipe.id)}
                      style={{
                        padding: '4px 8px', borderRadius: '4px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                        color: 'var(--text-main)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                      }}
                    >
                      <History size={12}/> History ({HistoryEngine.getLogsForRecipe(g.recipe.id).length})
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View for SRS Data */}
      <div className="srs-card-view hidden-desktop">
        {filteredItems.map(g => (
          <div key={g.recipe.id} className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', opacity: disabledIds.has(g.recipe.id) ? 0.65 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  type="checkbox"
                  checked={!disabledIds.has(g.recipe.id)}
                  onChange={() => handleToggleRecipe(g.recipe.id)}
                  style={{ cursor: 'pointer', width: '20px', height: '20px', accentColor: 'var(--accent-mint)' }}
                />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#FFF' }}>
                    {g.displayName} {disabledIds.has(g.recipe.id) && <span style={{ fontSize: '0.7rem', color: '#EF4444', marginLeft: '4px' }}>(PAUSED)</span>}
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Last: {formatRelativeTime(g.lastTimestamp)}</div>
                </div>
              </div>
              <span
                style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  background: g.type === 'hot' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                  color: g.type === 'hot' ? '#EF4444' : '#3B82F6',
                }}
              >
                {g.type.toUpperCase()}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>ACCURACY</span>
                <span style={{ fontWeight: 800, color: g.passRate >= 80 ? 'var(--accent-mint)' : '#FFF' }}>
                  {g.totalReviews > 0 ? `${g.passRate}% (${g.totalCorrect}/${g.totalReviews} passed)` : '—'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>SRS WEIGHT</span>
                <span style={{ fontWeight: 800, color: '#FFF' }}>
                  {Math.round(g.weight)}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>STATUS</span>
                <span style={{ 
                  fontWeight: 800, 
                  color: g.masteryStatus === 'Mastered' ? 'var(--accent-mint)' : g.masteryStatus === 'Learning' ? '#3B82F6' : 'var(--status-fail)' 
                }}>
                  {g.masteryStatus}
                </span>
              </div>
            </div>

            <button
              onClick={() => setSelectedRecipeHistoryId(g.recipe.id)}
              style={{
                width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                color: 'var(--text-main)', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
              }}
            >
              <History size={14}/> View History ({HistoryEngine.getLogsForRecipe(g.recipe.id).length})
            </button>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 700 }}>
                <span style={{ color: g.confidenceScore >= 75 ? 'var(--accent-mint)' : g.confidenceScore >= 50 ? '#F59E0B' : 'var(--status-fail)' }}>
                  Confidence: {g.confidenceScore}%
                </span>
                <span style={{ color: 'var(--text-muted)' }}>{g.totalReviews} reviews</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'var(--bg-primary)', borderRadius: '3px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${g.confidenceScore}%`,
                    height: '100%',
                    background: g.confidenceScore >= 75 ? 'var(--accent-mint)' : g.confidenceScore >= 50 ? '#F59E0B' : 'var(--status-fail)',
                    borderRadius: '3px'
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {toastNotification && (
        <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(5, 150, 105, 0.9)', border: '1px solid var(--accent-mint)', padding: '0.85rem 1.25rem', borderRadius: '8px', fontSize: '0.85rem', color: '#FFF', display: 'flex', alignItems: 'center', gap: '10px', zIndex: 9999 }}>
          <Info size={18} /> <span>{toastNotification}</span>
        </div>
      )}

      {filterStatus === 'all-history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: 'var(--bg-primary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select value={historySort} onChange={e => setHistorySort(e.target.value as any)} style={{ background: 'var(--bg-surface)', color: '#FFF', border: '1px solid var(--border-subtle)', padding: '0.4rem', borderRadius: '6px' }}>
                <option value="newest">Most Recent First</option>
                <option value="oldest">Oldest First</option>
              </select>
              <select value={historyResultFilter} onChange={e => setHistoryResultFilter(e.target.value as any)} style={{ background: 'var(--bg-surface)', color: '#FFF', border: '1px solid var(--border-subtle)', padding: '0.4rem', borderRadius: '6px' }}>
                <option value="all">All Results</option>
                <option value="pass">Pass Only</option>
                <option value="fail">Fail Only</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {historyLogs
              .filter(l => historyResultFilter === 'all' ? true : historyResultFilter === 'pass' ? l.pass : !l.pass)
              .sort((a, b) => historySort === 'newest' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp)
              .map(log => (
                <div key={log.id} className="card" style={{ padding: '1rem', borderLeft: `4px solid ${log.pass ? 'var(--accent-mint)' : 'var(--status-fail)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#FFF' }}>{log.recipeName} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({log.recipeCode || 'Std'})</span></h3>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatRelativeTime(log.timestamp)}</div>
                    </div>
                    <div style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 800, background: log.pass ? 'rgba(5, 150, 105, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: log.pass ? 'var(--accent-mint)' : 'var(--status-fail)' }}>
                      {log.pass ? 'PASS' : 'FAIL'}
                    </div>
                  </div>
                  <div style={{ margin: '0.75rem 0', fontSize: '0.85rem', color: 'var(--text-main)', background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '6px' }}>
                    <span style={{ color: 'var(--accent-mint)', fontWeight: 700 }}>Transcript: </span>{log.transcript}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <button onClick={() => setDebugLogModal(log.debugLog)} style={{ padding: '6px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Terminal size={14}/> View Debug Log</button>
                    <button onClick={() => playAudio(log.audioId)} disabled={!log.audioId} style={{ padding: '6px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', borderRadius: '6px', fontSize: '0.8rem', cursor: log.audioId ? 'pointer' : 'not-allowed', opacity: log.audioId ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: '4px' }}><Play size={14}/> Play Audio</button>
                    <button onClick={() => handleRevertGrade(log)} style={{ padding: '6px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><ArrowUpDown size={14}/> Mark {log.pass ? 'Fail' : 'Pass'}</button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {selectedRecipeHistoryId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem', boxSizing: 'border-box', backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ maxWidth: '500px', width: '100%', maxHeight: '85vh', overflowY: 'auto', borderRadius: '12px', margin: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#FFF' }}>
                History: {recipes.find(r => r.id === selectedRecipeHistoryId)?.name}
              </h3>
              <button onClick={() => setSelectedRecipeHistoryId(null)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><XCircle size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {historyLogs.filter(l => l.recipeId === selectedRecipeHistoryId).sort((a,b)=>b.timestamp - a.timestamp).map(log => (
                <div key={log.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '1rem', background: 'var(--bg-primary)', borderLeft: `4px solid ${log.pass ? 'var(--accent-mint)' : 'var(--status-fail)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatRelativeTime(log.timestamp)}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: log.pass ? 'var(--accent-mint)' : 'var(--status-fail)' }}>{log.pass ? 'PASS' : 'FAIL'}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>{log.transcript}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <button onClick={() => setDebugLogModal(log.debugLog)} style={{ padding: '4px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Terminal size={12}/> Log</button>
                    <button onClick={() => playAudio(log.audioId)} disabled={!log.audioId} style={{ padding: '4px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', borderRadius: '4px', fontSize: '0.75rem', cursor: log.audioId ? 'pointer' : 'not-allowed', opacity: log.audioId ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: '4px' }}><Play size={12}/> Audio</button>
                    <button onClick={() => handleRevertGrade(log)} style={{ padding: '4px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><ArrowUpDown size={12}/> Mark {log.pass ? 'Fail' : 'Pass'}</button>
                  </div>
                </div>
              ))}
              {historyLogs.filter(l => l.recipeId === selectedRecipeHistoryId).length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No history for this recipe yet.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {debugLogModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem', boxSizing: 'border-box', backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ maxWidth: '500px', width: '100%', maxHeight: '85vh', overflowY: 'auto', borderRadius: '12px', margin: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-mint)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Terminal size={18} /> Evaluation Debug Log ({debugLogModal.timestamp})
              </h3>
              <button onClick={() => setDebugLogModal(null)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
                <XCircle size={20} />
              </button>
            </div>
            
            <div style={{ padding: '1rem', background: 'var(--bg-primary)', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>Store Manager Feedback:</div>
              <FormattedFeedbackText text={debugLogModal.rawResponseText || ''} pass={true} />
            </div>

            {debugLogModal.audioBlobUrl && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Recorded Audio Playback:</div>
                <audio controls src={debugLogModal.audioBlobUrl} style={{ width: '100%' }} />
              </div>
            )}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>System Prompt Persona:</div>
              <pre style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>{debugLogModal.systemPrompt}</pre>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>Request Prompt:</div>
              <pre style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--text-main)', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>{debugLogModal.requestPrompt}</pre>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>Raw Gemini JSON Response:</div>
              <pre style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--accent-mint)', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>{debugLogModal.rawResponseText}</pre>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
