import { useState } from 'react';
import type { Recipe } from '../types/recipe';
import { SRSEngine, type WeightData } from '../services/srsEngine';
import { Activity, Award, Zap, ShieldCheck, ArrowUpDown } from 'lucide-react';

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
  const [filterStatus, setFilterStatus] = useState<'all' | 'mastered' | 'learning' | 'practice'>('all');
  const [sortBy, setSortBy] = useState<'grouped' | 'weight-desc' | 'confidence-asc' | 'reviews-desc' | 'name-asc'>('grouped');

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

      // Confidence Score % formula based on SM-2 weight range (10 to 250)
      const weightPenalty = Math.min(100, Math.max(0, ((weight - 10) / 240) * 100));
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
      
      {/* Header Title */}
      <div>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-mint)', letterSpacing: '1px', textTransform: 'uppercase' }}>
          SRS MEMORY METRICS & ANALYTICS
        </span>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '4px 0 0 0', color: '#FFF' }}>
          Recipe SRS Dashboard
        </h1>
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
        <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--bg-primary)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
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
        </div>

        {/* Sort Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
              cursor: 'pointer'
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
                <th style={{ padding: '0.85rem 1rem' }}>Recipe Name</th>
                <th style={{ padding: '0.85rem 1rem' }}>Type</th>
                <th style={{ padding: '0.85rem 1rem' }}>SRS Weight</th>
                <th style={{ padding: '0.85rem 1rem' }}>Confidence Meter</th>
                <th style={{ padding: '0.85rem 1rem' }}>Accuracy</th>
                <th style={{ padding: '0.85rem 1rem' }}>Last Drilled</th>
                <th style={{ padding: '0.85rem 1rem' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(g => (
                <tr key={g.recipe.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  
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

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View for SRS Data */}
      <div className="srs-card-view hidden-desktop">
        {filteredItems.map(g => (
          <div key={g.recipe.id} className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#FFF' }}>{g.displayName}</h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Last: {formatRelativeTime(g.lastTimestamp)}</div>
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
                  {g.totalReviews > 0 ? `${g.passRate}%` : '—'}
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

    </div>
  );
}
