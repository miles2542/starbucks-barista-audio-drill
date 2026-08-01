export interface EvaluationResult {
  pass: boolean;
  isError?: boolean;
  score: number;
  feedback: string;
  transcribedSpeech: string;
}

export interface RecipeContext {
  drinkName: string;
  size: string;
  temperature: string;
}

export interface UserAction {
  step: string;
  action: string;
}

export interface EvaluationDebugLog {
  timestamp: string;
  systemPrompt: string;
  requestPrompt: string;
  rawResponseText: string;
  parsedResult: EvaluationResult;
  audioBlobUrl?: string;
}

export let lastEvaluationDebugLog: EvaluationDebugLog | null = null;

const SYSTEM_PROMPT = `You are a strict, demanding, zero-fluff Starbucks Store Manager evaluating a trainee barista's recipe recall.

CRITICAL STARBUCKS RECIPE CONTEXT & EVALUATION RULES:
1. CODE-SWITCHING & PHONETIC NORMALIZATION (VIETNAMESE + ENGLISH):
   - Trainee recites recipes by mixing English barista terms ("Hot Latte", "steam milk", "queue shot", "latte art") with Vietnamese words ("đầu tiên sẽ là", "rót sữa", "vạch cao nhất").
   - ASR PHONETIC RECOGNITION: Recognize English terms spoken with Vietnamese accent or phonetically transliterated:
     * "hạt lờ tề" / "lờ tề" = Hot Latte / Latte
     * "dieu tien" / "điều tiên" = đầu tiên
     * "kem" / "đá" / "phum" / "xirô" = syrup / ice / pumps
   - In "transcribedSpeech", transcribe into clean, natural Vietnamese + English terms (e.g. write "Hot Latte đầu tiên..." rather than literal phonetic artifacts like "Hạt lờ tề...").
2. MARK CUP CODES: The single-letter code in parentheses like "(L)", "(C)", or "(A)" is the MARK CUP CODE!
   - (L) = Caffe Latte
   - (C) = Cappuccino
   - (A) = Caffe Americano
   NEVER refer to "(L)" as "Large"! "L" means Latte.
3. 3-NUMBER SHORT OMISSION RULE (CRITICAL - DO NOT FAIL FOR THIS):
   - Starbucks core recipes list 4 numbers: [Short | Tall | Grande | Venti].
   - Trainees usually omit Short size and recite ONLY 3 numbers for [Tall | Grande | Venti].
   - EXAMPLES OF 100% PASSING ANSWERS:
     * If target Shots is "1 2 2 3" (Short 1, Tall 2, Grande 2, Venti 3) and trainee recites "2 2 3" (for Tall, Grande, Venti), THIS IS 100% CORRECT PASS!
     * If target Syrup is "2 3 4 5" (Short 2, Tall 3, Grande 4, Venti 5) and trainee recites "3 4 5" (for Tall, Grande, Venti), THIS IS 100% CORRECT PASS!
   - DO NOT REQUIRE SHORT SIZE NUMBERS! If Tall, Grande, Venti numbers match, set "pass": true!
4. NO SPEECH DETECTED / SYSTEM ERROR HANDLING:
   - If the audio clip is silent, empty, or contains no audible voice, set "isError": true, "pass": false, "score": 0, and "feedback": "No speech audio detected. Please check microphone and speak clearly into the mic."
5. EVALUATION & FULL REINFORCEMENT RULES:
   - Binary PASS or FAIL logic.
   - NO soft filler, NO comforting phrasing ("Good try", "Almost there").
   - ON PASS: "feedback" string should simply be "PASS. Recipe recalled correctly."
   - ON FAIL REINFORCEMENT: If the result is FAIL, the "feedback" string MUST start with a concise error callout, and then MUST state the complete correct recipe steps in exact order (1. Steam milk, 2. Queue shots, 3. Add syrup, 4. Finish & connect).
   - In "transcribedSpeech", output clean, natural transcription of what you hear in the audio clip.
   - Return ONLY valid JSON matching this exact structure:
     {
       "pass": boolean,
       "isError": boolean,
       "score": number,
       "feedback": string,
       "transcribedSpeech": string
     }`;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function evaluateWithGemini(
  apiKey: string,
  recipe: RecipeContext,
  actions: UserAction[],
  audioBlob?: Blob,
  audioBlobUrl?: string
): Promise<EvaluationResult> {
  if (!apiKey) {
    return fallbackGrader(recipe, actions, audioBlobUrl);
  }

  const cleanRecipePrompt = {
    drinkName: recipe.drinkName,
    temperature: recipe.temperature,
    noteOnSizes: "Trainee may recite 3 numbers for Tall, Grande, Venti (omitting Short). This is 100% PASS!"
  };

  const promptText = `Target Recipe: ${JSON.stringify(cleanRecipePrompt, null, 2)}\nTrainee Recalled Steps Text: ${JSON.stringify(actions, null, 2)}\nEvaluate execution against standard Starbucks recipe rules.`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;

    const parts: any[] = [];

    // Multimodal Audio Attachment
    if (audioBlob && audioBlob.size > 500) {
      const base64Audio = await blobToBase64(audioBlob);
      const cleanMimeType = (audioBlob.type || 'audio/webm').split(';')[0];

      parts.push({
        inlineData: {
          mimeType: cleanMimeType,
          data: base64Audio
        }
      });
      parts.push({
        text: `Listen to the attached audio clip above of the trainee reciting the recipe in Vietnamese or English. 1) Transcribe what you hear into clean natural Vietnamese + English terms in "transcribedSpeech". 2) Evaluate against target recipe (omitting Short size numbers is 100% PASS). If audio is silent/inaudible set "isError": true:\n${promptText}`
      });
    } else {
      parts.push({ text: promptText });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: SYSTEM_PROMPT }]
        },
        contents: [{
          parts: parts
        }],
        generationConfig: {
          response_mime_type: "application/json"
        }
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!rawText) {
      throw new Error('Invalid response format');
    }

    const parsed = JSON.parse(rawText) as EvaluationResult;
    if (parsed.transcribedSpeech && (parsed.transcribedSpeech.toLowerCase().includes('no speech') || parsed.transcribedSpeech.toLowerCase().includes('không nghe thấy'))) {
      parsed.isError = true;
      parsed.pass = false;
    }

    // Save debug log for modal viewer
    lastEvaluationDebugLog = {
      timestamp: new Date().toLocaleTimeString(),
      systemPrompt: SYSTEM_PROMPT,
      requestPrompt: promptText,
      rawResponseText: rawText,
      parsedResult: parsed,
      audioBlobUrl: audioBlobUrl
    };

    return parsed;
  } catch (error: any) {
    console.error("Gemini API error:", error);
    const errRes: EvaluationResult = {
      pass: false,
      isError: true,
      score: 0,
      feedback: `SYSTEM ERROR: Unable to process audio. (${error?.message || error})`,
      transcribedSpeech: '(Audio evaluation error)'
    };
    lastEvaluationDebugLog = {
      timestamp: new Date().toLocaleTimeString(),
      systemPrompt: SYSTEM_PROMPT,
      requestPrompt: promptText,
      rawResponseText: `API Error: ${error?.message || error}`,
      parsedResult: errRes,
      audioBlobUrl: audioBlobUrl
    };
    return errRes;
  }
}

function fallbackGrader(_recipe: RecipeContext, actions: UserAction[], audioBlobUrl?: string): EvaluationResult {
  const userSpoken = actions.find(a => a.step === 'Trainee Spoken Recalled Answer')?.action || '';
  
  if (!userSpoken || userSpoken.includes('(No speech') || userSpoken.includes('(Audio recorded)')) {
    const errRes: EvaluationResult = {
      pass: false,
      isError: true,
      score: 0,
      feedback: "SYSTEM ERROR: No speech detected in audio recording.",
      transcribedSpeech: "(No speech detected)"
    };
    lastEvaluationDebugLog = {
      timestamp: new Date().toLocaleTimeString(),
      systemPrompt: SYSTEM_PROMPT,
      requestPrompt: JSON.stringify(actions, null, 2),
      rawResponseText: JSON.stringify(errRes, null, 2),
      parsedResult: errRes,
      audioBlobUrl: audioBlobUrl
    };
    return errRes;
  }

  const actsStr = JSON.stringify(actions).toLowerCase();
  const hasEspresso = actsStr.includes('shot') || actsStr.includes('espresso') || actsStr.includes('2 2 3');
  const hasMilk = actsStr.includes('milk') || actsStr.includes('steam') || actsStr.includes('sữa');

  const result: EvaluationResult = {
    pass: hasEspresso && hasMilk,
    isError: false,
    score: (hasEspresso && hasMilk) ? 100 : 0,
    feedback: (hasEspresso && hasMilk) ? "PASS. Recipe recalled correctly." : "FAIL. Missing essential drink components.",
    transcribedSpeech: userSpoken
  };

  lastEvaluationDebugLog = {
    timestamp: new Date().toLocaleTimeString(),
    systemPrompt: SYSTEM_PROMPT,
    requestPrompt: JSON.stringify(actions, null, 2),
    rawResponseText: JSON.stringify(result, null, 2),
    parsedResult: result,
    audioBlobUrl: audioBlobUrl
  };

  return result;
}
