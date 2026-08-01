import { useState, useEffect } from 'react';
import type { Recipe } from '../types/recipe';
import { audioListener, speakTextGemini, speakTextWeb } from '../services/audioEngine';
import { SRSEngine } from '../services/srsEngine';
import { evaluateWithGemini, lastEvaluationDebugLog, type EvaluationDebugLog, type EvaluationResult } from '../services/geminiGrader';
import { Mic, Check, X, Loader, Award, RefreshCw, Square, FileText, Terminal, XCircle, Volume2, MessageSquare, Sparkles, Sliders, RotateCcw, Ban, Shuffle, AlertTriangle, Key } from 'lucide-react';

interface QuizModeProps {
  recipes: Recipe[];
  onComplete: () => void;
}

export function QuizMode({ recipes, onComplete }: QuizModeProps) {
  const [currentRecipe, setCurrentRecipe] = useState<Recipe | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [audioVolume, setAudioVolume] = useState(0);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [currentDebugLog, setCurrentDebugLog] = useState<EvaluationDebugLog | null>(null);
  
  const [autoAdvanceMode, setAutoAdvanceMode] = useState<'handsfree' | 'manual'>('handsfree');

  const apiKey = localStorage.getItem('gemini_api_key') || '';

  useEffect(() => {
    if (recipes.length > 0 && !currentRecipe) {
      setCurrentRecipe(SRSEngine.getNextRecipe(recipes));
    }
  }, [recipes]);

  const startListeningInternal = (targetRecipe: Recipe) => {
    setIsListening(true);
    setLiveTranscript('');
    setEvaluation(null);
    setCurrentDebugLog(null);

    audioListener.start(
      async (spokenText: string, audioBlob?: Blob) => {
        setIsListening(false);
        setAudioVolume(0);
        setIsGrading(true);

        const recordedBlob = audioBlob || audioListener.getRecordedAudioBlob();
        const audioUrl = recordedBlob ? URL.createObjectURL(recordedBlob) : undefined;

        const textToEvaluate = spokenText || liveTranscript || '(No speech detected)';
        const stepsText = `Steam: ${targetRecipe.steps.steamMilk} | Shots: ${targetRecipe.steps.queueShots} | Syrup: ${targetRecipe.steps.pumpSyrup} | Finish: ${targetRecipe.steps.finish}`;

        try {
          const result = await evaluateWithGemini(apiKey, {
            drinkName: `${targetRecipe.name} (Mark Cup: ${targetRecipe.code || 'Standard'})`,
            size: 'Short / Tall / Grande / Venti',
            temperature: targetRecipe.type
          }, [
            { step: 'Target Recipe Steps', action: stepsText },
            { step: 'Trainee Spoken Recalled Answer', action: textToEvaluate }
          ], recordedBlob || undefined, audioUrl);

          setEvaluation(result);
          setCurrentDebugLog(lastEvaluationDebugLog);

          // ONLY update SRS state if NOT an error!
          if (!result.isError) {
            const allIds = recipes.map(r => r.id);
            SRSEngine.updateItem(targetRecipe.id, result.pass, allIds);
          }

          if (result.isError) {
            // On ERROR: Speak error notification
            speakTextWeb("No speech audio detected.", 1.10);
          } else if (result.pass) {
            // On PASS: Instant Web Speech "Pass!"
            speakTextWeb("Pass!", 1.10);

            // Auto-advance if in hands-free mode
            if (autoAdvanceMode === 'handsfree') {
              setTimeout(() => {
                advanceToNext(true);
              }, 1200);
            }
          } else {
            // On FAIL: Gemini 3.1 TTS speaks Store Manager feedback
            speakTextGemini(result.feedback, apiKey, 1.10);
          }

        } catch (e) {
          const errRes: EvaluationResult = {
            pass: false,
            isError: true,
            score: 0,
            feedback: `SYSTEM ERROR: Unable to process audio.`,
            transcribedSpeech: textToEvaluate
          };
          setEvaluation(errRes);
          setCurrentDebugLog(lastEvaluationDebugLog);
          speakTextWeb("Audio processing error.", 1.10);
        } finally {
          setIsGrading(false);
        }
      },
      (interimText: string) => {
        setLiveTranscript(interimText);
      },
      (vol: number) => {
        setAudioVolume(vol);
      }
    );
  };

  const handleToggleListening = () => {
    if (isListening) {
      audioListener.stopManual();
      setIsListening(false);
      setAudioVolume(0);
      return;
    }

    if (currentRecipe) {
      startListeningInternal(currentRecipe);
    }
  };

  const handleCancelRecording = () => {
    audioListener.cancel();
    setIsListening(false);
    setAudioVolume(0);
    setLiveTranscript('');
  };

  const handleRetryCurrentDrink = () => {
    setEvaluation(null);
    setLiveTranscript('');
    setCurrentDebugLog(null);
    if (currentRecipe) {
      startListeningInternal(currentRecipe);
    }
  };

  const handleSkipDrinkNoMetrics = () => {
    if (isListening) {
      audioListener.cancel();
      setIsListening(false);
    }
    setEvaluation(null);
    setLiveTranscript('');
    setCurrentDebugLog(null);

    const nextRecipe = SRSEngine.getNextRecipe(recipes, currentRecipe?.id);
    if (nextRecipe) {
      setCurrentRecipe(nextRecipe);
    }
  };

  const advanceToNext = (autoStart = false) => {
    setEvaluation(null);
    setLiveTranscript('');
    setCurrentDebugLog(null);
    
    const nextRecipe = SRSEngine.getNextRecipe(recipes, currentRecipe?.id);

    if (nextRecipe) {
      setCurrentRecipe(nextRecipe);

      speakTextWeb(`Next: ${nextRecipe.name}`, 1.10);

      if (autoStart && autoAdvanceMode === 'handsfree') {
        setTimeout(() => {
          startListeningInternal(nextRecipe);
        }, 2200);
      }
    } else {
      onComplete();
    }
  };

  const handleManualGrade = (pass: boolean) => {
    if (currentRecipe) {
      const allIds = recipes.map(r => r.id);
      SRSEngine.updateItem(currentRecipe.id, pass, allIds);
    }
    advanceToNext(false);
  };

  if (!currentRecipe) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
        <Award size={48} style={{ color: 'var(--accent-mint)', marginBottom: '1rem' }} />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 8px 0', color: '#FFF' }}>
          All Mastered!
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0 }}>
          No recipes due for review right now.
        </p>
        <button
          onClick={() => {
            setCurrentRecipe(SRSEngine.getNextRecipe(recipes));
          }}
          style={{
            marginTop: '1.5rem',
            padding: '0.75rem 1.5rem',
            background: 'var(--accent-mint)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <RefreshCw size={16} /> Drill All 6 Recipes Now
        </button>
      </div>
    );
  }

  const dynamicScale = isListening ? 1 + (audioVolume / 100) * 0.4 : 1;
  const dynamicOpacity = isListening ? 0.3 + (audioVolume / 100) * 0.7 : 0.4;

  return (
    <div className="card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Chip Selector Mode Toggle & Skip Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{
          display: 'inline-flex',
          background: 'var(--bg-primary)',
          padding: '4px',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)',
          gap: '4px'
        }}>
          <button
            onClick={() => setAutoAdvanceMode('handsfree')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              background: autoAdvanceMode === 'handsfree' ? 'var(--accent-mint)' : 'transparent',
              color: autoAdvanceMode === 'handsfree' ? '#FFF' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            <Sparkles size={14} /> Hands-Free (Auto-Advance)
          </button>
          <button
            onClick={() => setAutoAdvanceMode('manual')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              background: autoAdvanceMode === 'manual' ? 'var(--accent-mint)' : 'transparent',
              color: autoAdvanceMode === 'manual' ? '#FFF' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            <Sliders size={14} /> Manual Review
          </button>
        </div>

        <button
          onClick={handleSkipDrinkNoMetrics}
          title="Switch to another drink at will (does not affect SRS metrics)"
          style={{
            padding: '0.5rem 0.85rem',
            background: 'var(--bg-primary)',
            color: 'var(--text-muted)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Shuffle size={14} /> Skip Drink
        </button>
      </div>

      {/* Missing API Key Alert Banner for New Trainees */}
      {!apiKey && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid #F59E0B',
          padding: '0.85rem 1.25rem',
          borderRadius: '8px',
          fontSize: '0.85rem',
          color: '#FFF',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          textAlign: 'left'
        }}>
          <Key size={20} style={{ color: '#F59E0B', flexShrink: 0 }} />
          <span><strong>No Gemini API Key Saved:</strong> Please enter your free key in Settings to activate AI Store Manager grading & voice output.</span>
        </div>
      )}

      <div>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-mint)', letterSpacing: '1px', textTransform: 'uppercase' }}>
          STARBUCKS DRILL {autoAdvanceMode === 'handsfree' ? '• AUTO MODE' : '• MANUAL MODE'}
        </span>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '4px 0 0 0', color: '#FFF' }}>
          Recite: {currentRecipe.name}
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
          Say <strong style={{ color: 'var(--accent-mint)' }}>"Over"</strong> (or <strong>"Hết"</strong>) or tap mic again to finish.
        </p>
      </div>

      {/* Dynamic Voice Reactive Mic Container */}
      <div style={{ margin: '1.25rem 0', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
        <div style={{
          position: 'absolute',
          width: '110px',
          height: '110px',
          borderRadius: '50%',
          border: isListening ? '3px solid var(--accent-mint)' : '2px solid var(--border-subtle)',
          transform: `scale(${dynamicScale})`,
          opacity: dynamicOpacity,
          transition: 'transform 0.08s ease-out, opacity 0.08s ease-out',
          boxShadow: isListening && audioVolume > 15 ? '0 0 30px rgba(5, 150, 105, 0.6)' : 'none'
        }} />

        <button
          onClick={handleToggleListening}
          disabled={isGrading}
          style={{
            width: '90px',
            height: '90px',
            borderRadius: '50%',
            border: 'none',
            background: isListening ? 'var(--status-fail)' : 'var(--accent-mint)',
            color: 'white',
            cursor: isGrading ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isListening ? '0 0 25px rgba(239, 68, 68, 0.6)' : '0 0 20px rgba(5, 150, 105, 0.4)',
            transition: 'all 0.2s ease',
            zIndex: 2,
            opacity: isGrading ? 0.6 : 1
          }}
        >
          {isListening ? <Square size={32} /> : <Mic size={40} />}
        </button>
      </div>

      {/* Cancel Recording Button while listening */}
      {isListening && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={handleCancelRecording}
            style={{
              padding: '0.45rem 0.9rem',
              background: 'rgba(239, 68, 68, 0.15)',
              color: 'var(--status-fail)',
              border: '1px solid var(--status-fail)',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Ban size={14} /> Cancel Recording (Discard)
          </button>
        </div>
      )}

      {/* Real-Time Live Spoken Transcript */}
      {isListening && liveTranscript && (
        <div style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-subtle)',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          fontSize: '0.9rem',
          color: 'var(--accent-mint)',
          fontStyle: 'italic',
          maxWidth: '500px',
          margin: '0 auto'
        }}>
          "{liveTranscript}"
        </div>
      )}

      {isGrading && (
        <div style={{ color: 'var(--accent-mint)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
          <Loader className="spin" size={18} /> Store Manager Evaluating (Gemini 3.5 Flash-Lite)...
        </div>
      )}

      {/* Verdict Feedback Card (PASS / FAIL / ERROR) */}
      {evaluation && (
        <div
          style={{
            padding: '1.25rem',
            borderRadius: '8px',
            textAlign: 'left',
            background: evaluation.isError 
              ? 'rgba(245, 158, 11, 0.12)' 
              : evaluation.pass ? 'rgba(5, 150, 105, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            border: evaluation.isError
              ? '1px solid #F59E0B'
              : evaluation.pass ? '1px solid var(--accent-mint)' : '1px solid var(--status-fail)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{
              fontWeight: 800,
              fontSize: '0.9rem',
              letterSpacing: '1px',
              color: evaluation.isError ? '#F59E0B' : evaluation.pass ? 'var(--accent-mint)' : 'var(--status-fail)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              {evaluation.isError ? <AlertTriangle size={18} /> : evaluation.pass ? <Check size={18} /> : <X size={18} />}
              {evaluation.isError ? 'SYSTEM / AUDIO ERROR (NOT COUNTED IN SRS)' : evaluation.pass ? 'STORE MANAGER VERDICT: PASS' : 'STORE MANAGER VERDICT: FAIL'}
            </span>
            {!evaluation.isError && (
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                Score: {evaluation.score}%
              </span>
            )}
          </div>

          <p style={{ fontSize: '0.95rem', margin: 0, color: '#FFF', lineHeight: '1.4' }}>
            {evaluation.feedback}
          </p>

          {evaluation.transcribedSpeech && !evaluation.isError && (
            <div style={{ fontSize: '0.85rem', color: 'var(--accent-mint)', background: 'var(--bg-primary)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MessageSquare size={14} />
              <span><strong>Heard Speech:</strong> "{evaluation.transcribedSpeech}"</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            {evaluation.isError ? (
              <button
                onClick={handleRetryCurrentDrink}
                style={{
                  flex: 1,
                  padding: '0.65rem',
                  background: '#F59E0B',
                  color: '#181A1B',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <RotateCcw size={16} /> Re-record Audio Turn
              </button>
            ) : evaluation.pass ? (
              <button
                onClick={() => advanceToNext(false)}
                style={{
                  flex: 1,
                  padding: '0.65rem',
                  background: 'var(--accent-mint)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Next Drink →
              </button>
            ) : (
              <button
                onClick={handleRetryCurrentDrink}
                style={{
                  flex: 1,
                  padding: '0.65rem',
                  background: 'var(--status-fail)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <RotateCcw size={16} /> Retry {currentRecipe.name}
              </button>
            )}

            <button
              onClick={() => setShowDebugModal(true)}
              style={{
                padding: '0.65rem 1rem',
                background: 'var(--bg-primary)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <FileText size={16} /> View Chat / Debug Log
            </button>
          </div>
        </div>
      )}

      {/* Manual Override Buttons */}
      {!evaluation && !isListening && !isGrading && (
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button
            onClick={() => handleManualGrade(true)}
            style={{
              padding: '0.5rem 1rem',
              background: 'transparent',
              color: 'var(--accent-mint)',
              border: '1px solid var(--accent-mint)',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Manual Pass
          </button>
          <button
            onClick={() => handleManualGrade(false)}
            style={{
              padding: '0.5rem 1rem',
              background: 'transparent',
              color: 'var(--status-fail)',
              border: '1px solid var(--status-fail)',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Manual Fail
          </button>
        </div>
      )}

      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        Active Drink: <strong>{currentRecipe.name}</strong>
      </div>

      {/* Evaluation Debug History Popup Modal */}
      {showDebugModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 100,
          padding: '1.5rem'
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '720px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.2rem 1.5rem',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--bg-primary)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Terminal size={20} style={{ color: 'var(--accent-mint)' }} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#FFF' }}>
                  Gemini Evaluation Chat History & Debug Log
                </h3>
              </div>
              <button
                onClick={() => setShowDebugModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <XCircle size={22} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
              {currentDebugLog ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        EVALUATION TIMESTAMP
                      </span>
                      <div style={{ fontSize: '0.9rem', color: '#FFF', marginTop: '2px', fontFamily: 'monospace' }}>
                        {currentDebugLog.timestamp}
                      </div>
                    </div>
                  </div>

                  {/* Playable Scrubbable Audio Player for Recorded Turn */}
                  {currentDebugLog.audioBlobUrl && (
                    <div style={{
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-subtle)',
                      padding: '1rem',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-mint)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Volume2 size={16} /> RECORDED TURN AUDIO (PLAYABLE & SCRUBBABLE)
                      </span>
                      <audio controls src={currentDebugLog.audioBlobUrl} style={{ width: '100%', marginTop: '4px' }} />
                    </div>
                  )}

                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-mint)', textTransform: 'uppercase' }}>
                      GEMINI TRANSCRIBED SPEECH HEARD
                    </span>
                    <div style={{
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-subtle)',
                      padding: '0.85rem',
                      borderRadius: '6px',
                      color: 'var(--accent-mint)',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      marginTop: '4px'
                    }}>
                      "{currentDebugLog.parsedResult.transcribedSpeech || 'Recited recipe steps.'}"
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      RAW USER PROMPT SENT TO GEMINI
                    </span>
                    <pre style={{
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-subtle)',
                      padding: '0.85rem',
                      borderRadius: '6px',
                      color: '#FFF',
                      fontSize: '0.85rem',
                      whiteSpace: 'pre-wrap',
                      marginTop: '4px'
                    }}>
                      {currentDebugLog.requestPrompt}
                    </pre>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      STORE MANAGER SYSTEM PROMPT (WITH CUP CODES KNOWLEDGE)
                    </span>
                    <pre style={{
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-subtle)',
                      padding: '0.85rem',
                      borderRadius: '6px',
                      color: 'var(--text-muted)',
                      fontSize: '0.8rem',
                      whiteSpace: 'pre-wrap',
                      maxHeight: '160px',
                      overflowY: 'auto',
                      marginTop: '4px'
                    }}>
                      {currentDebugLog.systemPrompt}
                    </pre>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-mint)', textTransform: 'uppercase' }}>
                      GEMINI STORE MANAGER RAW JSON RESPONSE
                    </span>
                    <pre style={{
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-subtle)',
                      padding: '0.85rem',
                      borderRadius: '6px',
                      color: 'var(--accent-mint)',
                      fontSize: '0.85rem',
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                      marginTop: '4px'
                    }}>
                      {currentDebugLog.rawResponseText}
                    </pre>
                  </div>
                </>
              ) : (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                  No evaluation history recorded for this turn.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-subtle)', textAlign: 'right', background: 'var(--bg-primary)' }}>
              <button
                onClick={() => setShowDebugModal(false)}
                style={{
                  padding: '0.55rem 1.25rem',
                  background: 'var(--accent-mint)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Close Debug Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
