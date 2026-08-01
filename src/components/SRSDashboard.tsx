import { useState } from 'react';
import type { Recipe } from '../types/recipe';
import { SRSEngine, type WeightData } from '../services/srsEngine';
import { Activity, Award, Zap, ShieldCheck, ArrowUpDown } from 'lucide-react';

interface SRSDashboardProps {
  recipes: Recipe[];
}

interface DrinkGroupMetrics {
  groupKey: string;
  displayName: string;
  code: string;
  recipes: Recipe[];
  totalCorrect: number;
  totalIncorrect: number;
  totalReviews: number;
  passRate: number;            // 0 - 100%
  avgWeight: number;           // Average selection weight
  confidenceScore: number;     // 0 - 100% calculated confidence rating
  masteryStatus: 'Mastered' | 'Learning' | 'Needs Practice';
  lastTimestamp?: number;
  avgSpeedMs?: number;
}

export function SRSDashboard({ recipes }: SRSDashboardProps) {
  const [filterStatus, setFilterStatus] = useState<'all' | 'mastered' | 'learning' | 'practice'>('all');
  const [sortBy, setSortBy] = useState<'weight-desc' | 'confidence-asc' | 'reviews-desc' | 'name-asc'>('weight-desc');

  const srsData = SRSEngine.loadAll();

  // Helper to group hot & iced drink variations into a single row
  const groupRecipes = (): DrinkGroupMetrics[] => {
    const groupsMap: Record<string, Recipe[]> = {};

    recipes.forEach(r => {
      // Group key: strip "Hot" / "Iced" prefixes and "(HOT)" / "(ICED)" codes
      let baseName = r.name.replace(/^(Hot|Iced)\s+/i, '');
      if (baseName.includes('(')) {
        baseName = baseName.split('(')[0].trim();
      }

      const key = baseName.toLowerCase();
      if (!groupsMap[key]) {
        groupsMap[key] = [];
      }
      groupsMap[key].push(r);
    });

    return Object.entries(groupsMap).map(([key, groupRecipes]) => {
      let totalCorrect = 0;
      let totalIncorrect = 0;
      let totalWeightSum = 0;
      let latestTimestamp = 0;
      let totalSpeedSum = 0;
      let speedCount = 0;

      groupRecipes.forEach(r => {
        const data: WeightData = srsData[r.id] || {
          id: r.id,
          weight: 100,
          correctCount: 0,
          incorrectCount: 0,
          turnsSinceLastGraded: 0
        };

        totalCorrect += data.correctCount || 0;
        totalIncorrect += data.incorrectCount || 0;
        totalWeightSum += data.weight || 100;

        if (data.lastGradedTimestamp && data.lastGradedTimestamp > latestTimestamp) {
          latestTimestamp = data.lastGradedTimestamp;
        }

        if (data.lastSpeedMs) {
          totalSpeedSum += data.lastSpeedMs;
          speedCount += 1;
        }
      });

      const avgWeight = totalWeightSum / groupRecipes.length;
      const totalReviews = totalCorrect + totalIncorrect;
      const passRate = totalReviews > 0 ? Math.round((totalCorrect / totalReviews) * 100) : 0;

      // Confidence Score % formula: 100% - normalized weight penalty + pass rate bonus
      // Weight ranges from 10 (Mastered) to 250 (Needs Practice)
      const weightPenalty = Math.min(100, Math.max(0, ((avgWeight - 10) / 240) * 100));
      let confidenceScore = Math.round(100 - weightPenalty);
      if (totalReviews === 0) confidenceScore = 50; // Neutral starting score

      let masteryStatus: 'Mastered' | 'Learning' | 'Needs Practice' = 'Learning';
      if (avgWeight <= 35 && totalReviews >= 2) {
        masteryStatus = 'Mastered';
      } else if (avgWeight >= 110 || passRate < 60) {
        masteryStatus = 'Needs Practice';
      }

      // Display name and mark cup code
      const firstRecipe = groupRecipes[0];
      let codeStr = firstRecipe.code || '';
      if (codeStr.includes('(')) {
        codeStr = codeStr.split('(')[0].trim();
      }

      const displayName = `${firstRecipe.name.replace(/^(Hot|Iced)\s+/i, '').split('(')[0].trim()} (${codeStr})`;

      return {
        groupKey: key,
        displayName: displayName,
        code: codeStr,
        recipes: groupRecipes,
        totalCorrect,
        totalIncorrect,
        totalReviews,
        passRate,
        avgWeight,
        confidenceScore,
        masteryStatus,
        lastTimestamp: latestTimestamp || undefined,
        avgSpeedMs: speedCount > 0 ? Math.round(totalSpeedSum / speedCount) : undefined
      };
    });
  };

  const groups = groupRecipes();

  // Filter & Sort
  const filteredGroups = groups.filter(g => {
    if (filterStatus === 'mastered') return g.masteryStatus === 'Mastered';
    if (filterStatus === 'learning') return g.masteryStatus === 'Learning';
    if (filterStatus === 'practice') return g.masteryStatus === 'Needs Practice';
    return true;
  });

  filteredGroups.sort((a, b) => {
    if (sortBy === 'weight-desc') return b.avgWeight - a.avgWeight;
    if (sortBy === 'confidence-asc') return a.confidenceScore - b.confidenceScore;
    if (sortBy === 'reviews-desc') return b.totalReviews - a.totalReviews;
    if (sortBy === 'name-asc') return a.displayName.localeCompare(b.displayName);
    return 0;
  });

  // Global Statistics
  const totalMastered = groups.filter(g => g.masteryStatus === 'Mastered').length;
  const globalReviews = groups.reduce((acc, g) => acc + g.totalReviews, 0);
  const globalCorrect = groups.reduce((acc, g) => acc + g.totalCorrect, 0);
  const globalAccuracy = globalReviews > 0 ? Math.round((globalCorrect / globalReviews) * 100) : 0;
  const globalConfidence = Math.round(groups.reduce((acc, g) => acc + g.confidenceScore, 0) / (groups.length || 1));

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
          Recipe Mastery Dashboard
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
            {totalMastered} / {groups.length}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--accent-mint)' }}>
            {Math.round((totalMastered / (groups.length || 1)) * 100)}% Drink Groups
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
            SuperMemo SRS Engine
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
            All ({groups.length})
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
            Needs Practice ({groups.filter(g => g.masteryStatus === 'Needs Practice').length})
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
            <option value="weight-desc">Sort: Priority Weight (High to Low)</option>
            <option value="confidence-asc">Sort: Confidence (Lowest First)</option>
            <option value="reviews-desc">Sort: Most Practiced</option>
            <option value="name-asc">Sort: Drink Name (A-Z)</option>
          </select>
        </div>

      </div>

      {/* Grouped Drink SRS Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ padding: '0.85rem 1rem' }}>Drink Recipe</th>
                <th style={{ padding: '0.85rem 1rem' }}>Variations</th>
                <th style={{ padding: '0.85rem 1rem' }}>SRS Weight</th>
                <th style={{ padding: '0.85rem 1rem' }}>Confidence Meter</th>
                <th style={{ padding: '0.85rem 1rem' }}>Accuracy</th>
                <th style={{ padding: '0.85rem 1rem' }}>Last Drilled</th>
                <th style={{ padding: '0.85rem 1rem' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredGroups.map(g => (
                <tr key={g.groupKey} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  
                  {/* Drink Name */}
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#FFF' }}>
                    {g.displayName}
                  </td>

                  {/* Hot & Iced Badges */}
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {g.recipes.map(r => (
                        <span
                          key={r.id}
                          style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            background: r.type === 'hot' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                            color: r.type === 'hot' ? '#EF4444' : '#3B82F6',
                            border: `1px solid ${r.type === 'hot' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`
                          }}
                        >
                          {r.type.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Weight Score */}
                  <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'monospace' }}>
                    {Math.round(g.avgWeight)}
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

    </div>
  );
}
