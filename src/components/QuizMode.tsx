import { useState, useEffect, useRef, useCallback } from 'react';
import type { Recipe } from '../types/recipe';
import { audioListener, speakTextGemini, speakTextWeb } from '../services/audioEngine';
import { SRSEngine } from '../services/srsEngine';
import { evaluateWithGemini, lastEvaluationDebugLog, type EvaluationDebugLog, type EvaluationResult } from '../services/geminiGrader';
import { Mic, Check, X, Loader, Award, RefreshCw, Square, Terminal, XCircle, MessageSquare, Sparkles, Sliders, RotateCcw, Ban, Shuffle, AlertTriangle, Key, Info } from 'lucide-react';

interface QuizModeProps {
  recipes: Recipe[];
  onComplete: () => void;
}

function FormattedFeedbackText({ text, pass }: { text: string; pass: boolean }) {
  if (!text) return null;

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.92rem', lineHeight: '1.5' }}>
      {lines.map((line, idx) => {
        // FAIL / PASS Header line (e.g. **FAIL: Incorrect shot count**)
        if (line.startsWith('**FAIL:') || line.startsWith('**PASS:')) {
          const cleanHeader = line.replace(/\*\*/g, '');
          return (
            <div key={idx} style={{ fontWeight: 800, fontSize: '1rem', color: pass ? 'var(--accent-mint)' : 'var(--status-fail)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
              {cleanHeader}
            </div>
          );
        }

        // Bullet point lines (e.g. * **Heard:** "..." or * **Correction:** ...)
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

        // Section Headers (e.g. **Standard Recipe Steps:**)
        if (line.startsWith('**') && line.endsWith('**')) {
          return (
            <div key={idx} style={{ fontWeight: 700, color: 'var(--text-muted)', marginTop: '0.25rem', fontSize: '0.82rem', letterSpacing: '0.5px' }}>
              {line.replace(/\*\*/g, '')}
            </div>
          );
        }

        // Numbered Recipe Steps (e.g. 1. Steam milk)
        const numMatch = line.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', paddingLeft: '8px', color: 'var(--text-main)' }}>
              <span style={{ fontWeight: 700, color: 'var(--accent-mint)', minWidth: '18px' }}>{numMatch[1]}.</span>
              <span>{numMatch[2]}</span>
            </div>
          );
        }

        // Standard text line
        return (
          <div key={idx} style={{ color: 'var(--text-main)' }}>
            {line}
          </div>
        );
      })}
    </div>
  );
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
  const [toastNotification, setToastNotification] = useState<string | null>(null);
  
  const [autoAdvanceMode, setAutoAdvanceMode] = useState<'handsfree' | 'manual'>('handsfree');

  const timersRef = useRef<number[]>([]);

  const stopAllAudioAndTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    window.speechSynthesis.cancel();
  }, []);

  useEffect(() => {
    return () => {
      stopAllAudioAndTimers();
    };
  }, [stopAllAudioAndTimers]);

  const safeSetTimeout = (fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
  };

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

        try {
          const result = await evaluateWithGemini(apiKey, {
            drinkName: `${targetRecipe.name} (Mark Cup: ${targetRecipe.code || 'Standard'})`,
            size: targetRecipe.sizes?.join(', ') || 'Short, Tall, Grande, Venti',
            sizes: targetRecipe.sizes,
            temperature: targetRecipe.type,
            groundTruthSteps: {
              steamMilk: targetRecipe.steps.steamMilk,
              queueShots: targetRecipe.steps.queueShots,
              pumpSyrup: targetRecipe.steps.pumpSyrup,
              finish: targetRecipe.steps.finish
            }
          }, [
            { step: 'Trainee Spoken Recalled Answer', action: textToEvaluate }
          ], recordedBlob || undefined, audioUrl);

          setEvaluation(result);
          setCurrentDebugLog(lastEvaluationDebugLog);

          if (result.rotatedModelNotification) {
            setToastNotification(result.rotatedModelNotification);
          }

          if (!result.isError) {
            const allIds = recipes.map(r => r.id);
            SRSEngine.updateItem(targetRecipe.id, result.pass, allIds);
          }

          if (result.isError) {
            speakTextWeb("No speech audio detected.", 1.10);
          } else if (result.pass) {
            speakTextWeb("Pass!", 1.10);

            if (autoAdvanceMode === 'handsfree') {
              safeSetTimeout(() => {
                advanceToNext(true);
              }, 1200);
            }
          } else {
            speakTextWeb("Fail!", 1.10);
            safeSetTimeout(() => {
              speakTextGemini(result.feedback, apiKey, 1.10);
            }, 900);
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
    stopAllAudioAndTimers();
  };

  const handleRetryCurrentDrink = () => {
    stopAllAudioAndTimers();
    setEvaluation(null);
    setLiveTranscript('');
    setCurrentDebugLog(null);
    if (currentRecipe) {
      startListeningInternal(currentRecipe);
    }
  };

  const handleSkipDrinkNoMetrics = () => {
    stopAllAudioAndTimers();
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
    stopAllAudioAndTimers();
    setEvaluation(null);
    setLiveTranscript('');
    setCurrentDebugLog(null);
    
    const nextRecipe = SRSEngine.getNextRecipe(recipes, currentRecipe?.id);

    if (nextRecipe) {
      setCurrentRecipe(nextRecipe);

      speakTextWeb(`Next: ${nextRecipe.name}`, 1.10);

      if (autoStart && autoAdvanceMode === 'handsfree') {
        safeSetTimeout(() => {
          startListeningInternal(nextRecipe);
        }, 2200);
      }
    } else {
      onComplete();
    }
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
          <RefreshCw size={16} /> Drill Recipes Now
        </button>
      </div>
    );
  }

  const dynamicScale = isListening ? 1 + (audioVolume / 100) * 0.4 : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Top Control Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--bg-primary)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <button
            onClick={() => setAutoAdvanceMode('handsfree')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '6px',
              border: 'none',
              background: autoAdvanceMode === 'handsfree' ? 'var(--accent-mint)' : 'transparent',
              color: autoAdvanceMode === 'handsfree' ? '#FFF' : 'var(--text-muted)',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Sparkles size={14} /> Hands-Free
          </button>
          <button
            onClick={() => setAutoAdvanceMode('manual')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '6px',
              border: 'none',
              background: autoAdvanceMode === 'manual' ? 'var(--bg-surface)' : 'transparent',
              color: autoAdvanceMode === 'manual' ? '#FFF' : 'var(--text-muted)',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Sliders size={14} /> Manual
          </button>
        </div>

        <button
          onClick={handleSkipDrinkNoMetrics}
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

      {toastNotification && (
        <div style={{
          background: 'rgba(5, 150, 105, 0.15)',
          border: '1px solid var(--accent-mint)',
          padding: '0.85rem 1.25rem',
          borderRadius: '8px',
          fontSize: '0.85rem',
          color: '#FFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          textAlign: 'left'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Info size={18} style={{ color: 'var(--accent-mint)', flexShrink: 0 }} />
            <span>{toastNotification}</span>
          </div>
          <button
            onClick={() => setToastNotification(null)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

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
        <h1 style={{ fontSize: 'clamp(1.1rem, 4.5vw, 1.5rem)', fontWeight: 800, margin: '4px 0 0 0', color: '#FFF' }}>
          Recite: {currentRecipe.name}
        </h1>
      </div>

      {/* Interactive Microphone Button Card */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2.5rem 1.5rem', textTransform: 'none', position: 'relative' }}>
        <div style={{ position: 'relative', margin: '1rem 0' }}>
          {isListening && (
            <div
              style={{
                position: 'absolute',
                top: -12,
                left: -12,
                right: -12,
                bottom: -12,
                borderRadius: '50%',
                background: 'rgba(5, 150, 105, 0.25)',
                transform: `scale(${dynamicScale})`,
                transition: 'transform 0.08s ease-out',
                pointerEvents: 'none'
              }}
            />
          )}
          
          <button
            onClick={handleToggleListening}
            disabled={isGrading}
            style={{
              width: 'clamp(70px, 20vw, 95px)',
              height: 'clamp(70px, 20vw, 95px)',
              borderRadius: '50%',
              background: isListening ? 'var(--status-fail)' : 'var(--accent-mint)',
              color: 'white',
              border: 'none',
              cursor: isGrading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isListening ? '0 0 30px rgba(239, 68, 68, 0.5)' : '0 0 25px rgba(5, 150, 105, 0.4)',
              transition: 'all 0.2s ease',
              position: 'relative',
              zIndex: 2
            }}
          >
            {isGrading ? (
              <Loader size={36} className="spin-animation" />
            ) : isListening ? (
              <Square size={32} />
            ) : (
              <Mic size={36} />
            )}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: isListening ? 'var(--status-fail)' : '#FFF' }}>
            {isGrading ? (
              'Store Manager evaluating your recipe recall...'
            ) : isListening ? (
              'Listening... Recite 4 steps, then say "Headphone" or pause 7s'
            ) : (
              'Tap microphone to speak recipe'
            )}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {isListening ? 'Speak clearly: Steam milk -> Queue shots -> Add syrup -> Finish' : 'Hands-free voice recognition active'}
          </div>
        </div>

        {isListening && (
          <button
            onClick={handleCancelRecording}
            style={{
              marginTop: '1.25rem',
              padding: '0.45rem 1rem',
              background: 'rgba(239, 68, 68, 0.12)',
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
            <Ban size={14} /> Cancel Recording (Don't Grade)
          </button>
        )}

        {liveTranscript && (
          <div style={{
            marginTop: '1.25rem',
            padding: '0.75rem 1rem',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            fontSize: '0.85rem',
            color: 'var(--text-main)',
            maxWidth: '100%',
            wordBreak: 'break-word'
          }}>
            <span style={{ color: 'var(--accent-mint)', fontWeight: 700 }}>Heard: </span>
            "{liveTranscript}"
          </div>
        )}
      </div>

      {/* Structured Store Manager Feedback Card */}
      {evaluation && (
        <div 
          className="card" 
          style={{ 
            borderLeft: `4px solid ${evaluation.isError ? '#F59E0B' : evaluation.pass ? 'var(--accent-mint)' : 'var(--status-fail)'}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            background: evaluation.isError ? 'rgba(245, 158, 11, 0.05)' : evaluation.pass ? 'rgba(5, 150, 105, 0.05)' : 'rgba(239, 68, 68, 0.05)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {evaluation.isError ? (
                <AlertTriangle size={24} style={{ color: '#F59E0B' }} />
              ) : evaluation.pass ? (
                <Check size={24} style={{ color: 'var(--accent-mint)' }} />
              ) : (
                <X size={24} style={{ color: 'var(--status-fail)' }} />
              )}
              <span style={{ 
                fontWeight: 800, 
                fontSize: '1.2rem', 
                color: evaluation.isError ? '#F59E0B' : evaluation.pass ? 'var(--accent-mint)' : 'var(--status-fail)' 
              }}>
                {evaluation.isError ? 'SYSTEM ERROR' : evaluation.pass ? 'PASS' : 'FAIL'}
              </span>
            </div>

            {currentDebugLog && (
              <button
                onClick={() => setShowDebugModal(true)}
                style={{
                  background: 'var(--bg-primary)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-subtle)',
                  padding: '0.4rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Terminal size={14} /> Debug Log
              </button>
            )}
          </div>

          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MessageSquare size={14} /> STORE MANAGER FEEDBACK
            </div>
            
            {/* Structured HTML Formatted Feedback Component */}
            <FormattedFeedbackText text={evaluation.feedback} pass={evaluation.pass} />
          </div>

          {evaluation.transcribedSpeech && (
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <strong>ASR Transcribed Speech:</strong> "{evaluation.transcribedSpeech}"
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {!evaluation.pass && !evaluation.isError && (
                <button
                  onClick={handleRetryCurrentDrink}
                  style={{
                    flex: 1,
                    padding: '0.75rem 1rem',
                    background: 'var(--bg-primary)',
                    color: 'var(--status-fail)',
                    border: '1px solid var(--status-fail)',
                    borderRadius: '6px',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <RotateCcw size={16} /> Retry This Drink
                </button>
              )}

              <button
                onClick={() => advanceToNext(autoAdvanceMode === 'handsfree')}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  background: 'var(--accent-mint)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                Next Drink
              </button>
            </div>

            {!evaluation.isError && (
              <button
                onClick={() => {
                  if (currentRecipe) {
                    stopAllAudioAndTimers();
                    const allIds = recipes.map(r => r.id);
                    SRSEngine.revertAndReGrade(currentRecipe.id, !evaluation.pass, allIds);
                    setEvaluation({ ...evaluation, pass: !evaluation.pass });
                    setToastNotification(`Grade corrected to ${!evaluation.pass ? 'PASS' : 'FAIL'}`);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {evaluation.pass ? 'Mark Pass as Fail' : 'Mark Fail as Pass'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Manual Override Buttons */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sliders size={14} /> MANUAL OVERRIDE (IF OFF-LINE OR TESTING)
        </div>
        <div className="flex-col-mobile" style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => {
              const allIds = recipes.map(r => r.id);
              SRSEngine.updateItem(currentRecipe.id, true, allIds);
              advanceToNext(autoAdvanceMode === 'handsfree');
            }}
            style={{
              flex: 1,
              padding: '0.65rem',
              background: 'rgba(5, 150, 105, 0.15)',
              color: 'var(--accent-mint)',
              border: '1px solid var(--accent-mint)',
              borderRadius: '6px',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Manual Pass
          </button>
          <button
            onClick={() => {
              const allIds = recipes.map(r => r.id);
              SRSEngine.updateItem(currentRecipe.id, false, allIds);
              advanceToNext(false);
            }}
            style={{
              flex: 1,
              padding: '0.65rem',
              background: 'rgba(239, 68, 68, 0.15)',
              color: 'var(--status-fail)',
              border: '1px solid var(--status-fail)',
              borderRadius: '6px',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Manual Fail
          </button>
        </div>
      </div>

      {/* Debug Log Inspection Modal */}
      {showDebugModal && currentDebugLog && (
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
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="card" style={{ maxWidth: '650px', width: '100%', maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-mint)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Terminal size={18} /> Evaluation Debug Log ({currentDebugLog.timestamp})
              </h3>
              <button onClick={() => setShowDebugModal(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
                <XCircle size={20} />
              </button>
            </div>

            {currentDebugLog.audioBlobUrl && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>Recorded Audio Playback:</div>
                <audio controls src={currentDebugLog.audioBlobUrl} style={{ width: '100%' }} />
              </div>
            )}

            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>System Prompt Persona:</div>
              <pre style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                {currentDebugLog.systemPrompt}
              </pre>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>Request Prompt:</div>
              <pre style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--text-main)', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                {currentDebugLog.requestPrompt}
              </pre>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>Raw Gemini JSON Response:</div>
              <pre style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--accent-mint)', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                {currentDebugLog.rawResponseText}
              </pre>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
