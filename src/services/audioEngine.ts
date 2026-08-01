// Browser Web Speech Synthesis Fallback
export const speakTextWeb = (text: string, rate: number = 1.10): void => {
    stopSpeech();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    
    // Auto detect Vietnamese text and set appropriate language tag
    const isVietnamese = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text);
    utterance.lang = isVietnamese ? 'vi-VN' : 'en-US';
    
    window.speechSynthesis.speak(utterance);
};

let currentAudioElement: HTMLAudioElement | null = null;

// Convert raw Gemini PCM (24000Hz 16-bit Mono) into standard playable WAV Blob
function pcmToWavBlob(pcmBase64: string, sampleRate = 24000): Blob {
    const binaryString = atob(pcmBase64);
    const pcmLen = binaryString.length;
    const buffer = new ArrayBuffer(44 + pcmLen);
    const view = new DataView(buffer);

    const writeString = (v: DataView, offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
            v.setUint8(offset + i, str.charCodeAt(i));
        }
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + pcmLen, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // Byte rate
    view.setUint16(32, 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample
    writeString(view, 36, 'data');
    view.setUint32(40, pcmLen, true);

    const pcmView = new Uint8Array(buffer, 44);
    for (let i = 0; i < pcmLen; i++) {
        pcmView[i] = binaryString.charCodeAt(i);
    }

    return new Blob([buffer], { type: 'audio/wav' });
}

// Gemini 3.1 Flash TTS Audio Generation with 1.10x Cadence
export const speakTextGemini = async (text: string, apiKey?: string, rate: number = 1.10): Promise<boolean> => {
    stopSpeech();
    
    if (!apiKey) {
        speakTextWeb(text, rate);
        return false;
    }

    // Clean markdown formatting characters before passing to TTS voice engine
    const cleanSpeechText = text
        .replace(/[*_#`~]/g, '')
        .replace(/\n+/g, '. ')
        .trim();

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: `Read this Starbucks recipe clearly and naturally: ${cleanSpeechText}` }]
                }],
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: "Puck"
                            }
                        }
                    }
                }
            })
        });

        if (!response.ok) {
            console.warn('Gemini 3.1 TTS API error, falling back to Web Speech API', response.status);
            speakTextWeb(cleanSpeechText, rate);
            return false;
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        const parts = candidate?.content?.parts || [];
        let pcmBase64 = '';

        for (const p of parts) {
            const item = p.inlineData || p.inline_data;
            if (item && item.data) {
                pcmBase64 = item.data;
                break;
            }
        }

        if (!pcmBase64) {
            console.warn('No audio data in Gemini 3.1 response, falling back to Web Speech API');
            speakTextWeb(cleanSpeechText, rate);
            return false;
        }

        const wavBlob = pcmToWavBlob(pcmBase64, 24000);
        const audioUrl = URL.createObjectURL(wavBlob);
        currentAudioElement = new Audio(audioUrl);
        
        const targetRate = Math.max(0.5, Math.min(2.0, rate * 1.10));
        currentAudioElement.playbackRate = targetRate;
        currentAudioElement.defaultPlaybackRate = targetRate;
        
        await currentAudioElement.play();
        currentAudioElement.playbackRate = targetRate;
        return true;
    } catch (e) {
        console.warn('Gemini 3.1 TTS exception, falling back to Web Speech API', e);
        speakTextWeb(cleanSpeechText, rate);
        return false;
    }
};

export const speakText = (text: string, apiKey?: string, rate: number = 1.10): void => {
    speakTextGemini(text, apiKey, rate);
};

export const stopSpeech = (): void => {
    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
    }
    if (currentAudioElement) {
        currentAudioElement.pause();
        currentAudioElement = null;
    }
};

export class AudioListener {
    private recognition: any = null;
    private mediaRecorder: MediaRecorder | null = null;
    private mediaStream: MediaStream | null = null;
    private audioChunks: Blob[] = [];
    private silenceTimer: number | null = null;
    private triggerValidationTimer: number | null = null;
    private onFinalResultCallback: ((text: string, audioBlob?: Blob) => void) | null = null;
    private onInterimResultCallback: ((text: string) => void) | null = null;
    private onVolumeCallback: ((volume: number) => void) | null = null;
    private isListening: boolean = false;
    private currentTranscript: string = '';
    private audioCtx: AudioContext | null = null;
    private animFrameId: number | null = null;

    constructor() {
        this.initRecognition();
    }

    private initRecognition() {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'vi-VN';
            
            this.recognition.onresult = (event: any) => {
                this.resetSilenceTimer();
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }

                const fullTranscript = (this.currentTranscript + ' ' + finalTranscript + ' ' + interimTranscript).trim();
                
                if (this.onInterimResultCallback) {
                    this.onInterimResultCallback(fullTranscript);
                }

                // Official End Command Trigger Phrase: "Headphone" (with Vietnamese & English ASR phonetic variations)
                const endTriggerRegex = /(?:^|\s)(headphone|head\s*phone|hét\s*phôn|het\s*phone|hét\s*phone)[\s.,!?]*$/i;
                
                if (endTriggerRegex.test(fullTranscript)) {
                    // Cancel any previous validation timer
                    this.clearTriggerValidationTimer();

                    // 600ms Validation Buffer: Only stop if no new words arrive within 600ms!
                    // If trainee keeps speaking mid-sentence, new words will arrive and cancel this timer.
                    this.triggerValidationTimer = window.setTimeout(() => {
                        let cleanText = fullTranscript.replace(endTriggerRegex, '').trim();
                        this.currentTranscript = cleanText.length > 0 ? cleanText : fullTranscript;
                        console.log('[AudioListener] Headphone trigger confirmed. Submitting recording...');
                        this.stopManual();
                    }, 600);

                } else {
                    // New words arrived after trigger word -> cancel validation timer.
                    this.clearTriggerValidationTimer();
                    if (finalTranscript) {
                        this.currentTranscript = (this.currentTranscript + ' ' + finalTranscript).trim();
                    }
                }
            };

            this.recognition.onend = () => {
                if (this.isListening) {
                    try {
                        this.recognition.start();
                    } catch (e) {}
                }
            };
        }
    }

    private clearTriggerValidationTimer() {
        if (this.triggerValidationTimer !== null) {
            window.clearTimeout(this.triggerValidationTimer);
            this.triggerValidationTimer = null;
        }
    }

    public async start(
        onFinalResult: (text: string, audioBlob?: Blob) => void,
        onInterimResult?: (text: string) => void,
        onVolumeChange?: (volume: number) => void
    ) {
        this.onFinalResultCallback = onFinalResult;
        this.onInterimResultCallback = onInterimResult || null;
        this.onVolumeCallback = onVolumeChange || null;
        this.currentTranscript = '';
        this.audioChunks = [];
        this.isListening = true;

        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            if (typeof MediaRecorder !== 'undefined') {
                const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
                this.mediaRecorder = mimeType ? new MediaRecorder(this.mediaStream, { mimeType }) : new MediaRecorder(this.mediaStream);
                
                this.mediaRecorder.ondataavailable = (e) => {
                    if (e.data && e.data.size > 0) {
                        this.audioChunks.push(e.data);
                    }
                };
                
                this.mediaRecorder.start(100);
            }

            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            this.audioCtx = new AudioCtx();
            const source = this.audioCtx.createMediaStreamSource(this.mediaStream);
            const analyser = this.audioCtx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            
            const updateVolume = () => {
                if (!this.isListening) return;
                analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const avg = sum / dataArray.length;
                const normVol = Math.min(100, Math.round((avg / 128) * 100));
                
                if (this.onVolumeCallback) {
                    this.onVolumeCallback(normVol);
                }

                if (normVol > 10) {
                    this.resetSilenceTimer();
                }

                this.animFrameId = requestAnimationFrame(updateVolume);
            };

            updateVolume();

            if (this.recognition) {
                try {
                    this.recognition.start();
                } catch (e) {}
            }
            this.resetSilenceTimer();

        } catch (err) {
            console.error('Microphone initialization failed:', err);
            this.triggerFinalCallback('Error: Microphone access denied or not available.');
        }
    }

    public cancel() {
        this.onFinalResultCallback = null;
        this.clearTriggerValidationTimer();
        this.stop();
        this.cleanupStream();
    }

    public stopManual() {
        this.clearTriggerValidationTimer();
        this.flushAudioRecorderAndSubmit();
    }

    public stop() {
        this.isListening = false;
        this.clearSilenceTimer();
        this.clearTriggerValidationTimer();
        this.stopAudioAnalyzer();
        
        if (this.recognition) {
            try {
                this.recognition.stop();
            } catch (e) {}
        }
    }

    private triggerFinalCallback(text: string, blob?: Blob) {
        if (this.onFinalResultCallback) {
            const cb = this.onFinalResultCallback;
            this.onFinalResultCallback = null;
            cb(text, blob);
        }
        this.stop();
    }

    private resetSilenceTimer() {
        this.clearSilenceTimer();
        this.silenceTimer = window.setTimeout(() => {
            if (this.isListening) {
                this.flushAudioRecorderAndSubmit();
            }
        }, 7000);
    }

    private clearSilenceTimer() {
        if (this.silenceTimer !== null) {
            window.clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
    }

    private flushAudioRecorderAndSubmit() {
        const text = this.currentTranscript.trim();
        this.isListening = false;

        if (!this.onFinalResultCallback) {
            this.cleanupStream();
            return;
        }

        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.onstop = () => {
                const recordedBlob = new Blob(this.audioChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
                this.triggerFinalCallback(text || '(Audio recorded)', recordedBlob.size > 200 ? recordedBlob : undefined);
                this.cleanupStream();
            };
            this.mediaRecorder.stop();
        } else {
            const recordedBlob = this.getRecordedAudioBlob();
            this.triggerFinalCallback(text || '(Audio recorded)', recordedBlob && recordedBlob.size > 200 ? recordedBlob : undefined);
            this.cleanupStream();
        }
    }

    private stopAudioAnalyzer() {
        if (this.animFrameId !== null) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
        if (this.audioCtx) {
            try {
                this.audioCtx.close();
            } catch (e) {}
            this.audioCtx = null;
        }
        if (this.onVolumeCallback) {
            this.onVolumeCallback(0);
        }
    }

    private cleanupStream() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
    }

    public getRecordedAudioBlob(): Blob | null {
        if (this.audioChunks.length > 0) {
            return new Blob(this.audioChunks, { type: 'audio/webm' });
        }
        return null;
    }
}

export const audioListener = new AudioListener();

let wakeLock: WakeLockSentinel | null = null;

export const requestWakeLock = async (): Promise<void> => {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
        }
    } catch (err: any) {
        console.error(`${err.name}, ${err.message}`);
    }
};

export const releaseWakeLock = async (): Promise<void> => {
    if (wakeLock !== null) {
        await wakeLock.release();
        wakeLock = null;
    }
};
