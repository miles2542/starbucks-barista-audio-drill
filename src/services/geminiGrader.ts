export interface EvaluationResult {
  pass: boolean;
  isError?: boolean;
  score: number;
  feedback: string;
  transcribedSpeech: string;
  rotatedModelNotification?: string;
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
     * "hạt mocha" / "lờ mocha" = Hot Mocha / Mocha
     * "hạt caramel macchiato" / "mát ki a tô" = Hot Caramel Macchiato / Caramel Macchiato
     * "dieu tien" / "điều tiên" = đầu tiên
     * "kem" / "đá" / "phum" / "xirô" = syrup / ice / pumps
   - In "transcribedSpeech", transcribe into clean, natural Vietnamese + English terms.

2. STRICT MANDATORY RECIPE REQUIREMENTS (MUST FAIL IF OMITTED):
   - Hot Cappuccino (C): Trainee MUST explicitly mention reducing milk pitcher size by 1 size ("giảm size pitcher" / "giảm lượng sữa 1 size" unless size is Tall). If omitted, set "pass": false!
   - Iced Cappuccino (C): Foam MUST be under 6mm from rim ("foam dưới 6mm / cách 6mm"), NOT ice!
   - Hot Mocha (M): MUST stir espresso with mocha sauce, milk to 12mm below rim (NO FOAM), top with whipped cream.
   - Iced Mocha (M): MUST stir espresso with mocha sauce, milk to top line, ice to 6mm below rim, top with whipped cream (dome cap recommended).
   - Hot Caramel Macchiato (CM): MUST mention BOTH Vanilla AND Classic syrups (1 2 3 4 each), shots in shot glass, pour milk/foam 12mm below rim, shots poured through foam, caramel sauce 7-7-2.
   - Iced Caramel Macchiato (CM): MUST mention BOTH Vanilla AND Classic syrups (2 3 4 each), shots in shot glass, milk to top line, ice to 12mm below rim, shots poured on top of ice, caramel sauce 7-7-2.

3. ADAPTIVE FLEXIBILITY & SELF-CORRECTION (MUST PASS IF SELF-CORRECTED):
   - SELF-CORRECTION RULE: If trainee accidentally recites step B before step A, but immediately self-corrects ("thực ra phải làm step A trước rồi mới làm step B"), treat this as 100% CORRECT PASS!
   - 3-NUMBER SHORT OMISSION RULE: Starbucks core recipes list 4 numbers [Short | Tall | Grande | Venti]. Trainees usually omit Short size and recite ONLY 3 numbers for [Tall | Grande | Venti] (e.g. Shots "2 2 3" or Syrup "3 4 5"). This is 100% CORRECT PASS! Do NOT require Short size!

4. NO SPEECH DETECTED / SYSTEM ERROR HANDLING:
   - If the audio clip is silent, empty, or contains no audible voice, set "isError": true, "pass": false, "score": 0, and "feedback": "No speech audio detected. Please check microphone and speak clearly into the mic."

5. EVALUATION & WELL-FORMATTED STORE MANAGER FEEDBACK RULES:
   - Binary PASS or FAIL logic.
   - NO soft filler, NO comforting phrasing ("Good try", "Almost there").
   - ON PASS ("pass": true):
     * If 100% complete with no omitted optional details: Set "feedback": "PASS. Recipe recalled correctly."
     * If correct but omitted optional details (e.g. omitted Short size numbers): Set "feedback": "PASS. Recipe recalled correctly.\n\n**Bonus Note:** Short size for this drink takes [N] shots and [M] syrup pumps."
   - ON FAIL ("pass": false): Format the "feedback" string with structured Markdown using newlines, bold headers, and bulleted lists:
     **FAIL: [Short Concise Error Summary]**

     * **Heard:** "[Exact what trainee said]"
     * **Correction:** [Exact correction for the mistake]

     **Standard Recipe Steps:**
     1. [Step 1: Steam milk]
     2. [Step 2: Queue shots]
     3. [Step 3: Add syrup]
     4. [Step 4: Finish & connect]
   - In "transcribedSpeech", output clean, natural transcription of what you hear in the audio clip.`;

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

export function isModelExhausted(model: string): boolean {
  const dateStr = localStorage.getItem(`quota_exhausted_${model}`);
  if (!dateStr) return false;
  
  const savedDate = new Date(dateStr).toDateString();
  const todayDate = new Date().toDateString();
  
  if (savedDate === todayDate) {
    return true;
  } else {
    localStorage.removeItem(`quota_exhausted_${model}`);
    return false;
  }
}

export function markModelExhausted(model: string) {
  localStorage.setItem(`quota_exhausted_${model}`, new Date().toISOString());
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

  let preferredModel = localStorage.getItem('gemini_grader_model') || 'gemini-3.5-flash-lite';
  const selectedThinking = localStorage.getItem('gemini_thinking_level') || 'HIGH';

  let currentModel = preferredModel;
  let rotationNote: string | undefined = undefined;

  if (preferredModel !== 'gemini-3.5-flash-lite' && isModelExhausted(preferredModel)) {
    currentModel = 'gemini-3.5-flash-lite';
    rotationNote = `Model ${preferredModel} has exceeded its daily API quota (20 RPD limit). Auto-rotated to Gemini 3.5 Flash-Lite.`;
  }

  const cleanRecipePrompt = {
    drinkName: recipe.drinkName,
    temperature: recipe.temperature,
    noteOnSizes: "Trainee may recite 3 numbers for Tall, Grande, Venti (omitting Short). This is 100% PASS!"
  };

  const promptText = `Target Recipe: ${JSON.stringify(cleanRecipePrompt, null, 2)}\nTrainee Recalled Steps Text: ${JSON.stringify(actions, null, 2)}\nEvaluate execution against standard Starbucks recipe rules.`;

  const executeApiCall = async (modelToUse: string): Promise<{ data: any; modelUsed: string }> => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;

    const parts: any[] = [];

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
        text: `Listen to the attached audio clip above of the trainee reciting the recipe in Vietnamese or English. 1) Transcribe what you hear into clean natural Vietnamese + English terms in "transcribedSpeech". 2) Evaluate against target recipe strictly. If audio is silent/inaudible set "isError": true:\n${promptText}`
      });
    } else {
      parts.push({ text: promptText });
    }

    // Official Gemini Structured Output Schema API Configuration
    const genConfig: any = {
      response_mime_type: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          pass: { type: "BOOLEAN" },
          isError: { type: "BOOLEAN" },
          score: { type: "INTEGER" },
          feedback: { type: "STRING" },
          transcribedSpeech: { type: "STRING" }
        },
        required: ["pass", "score", "feedback", "transcribedSpeech"]
      }
    };

    if (selectedThinking === 'LOW') {
      genConfig.thinkingConfig = { thinkingBudget: 1024 };
    } else if (selectedThinking === 'HIGH') {
      genConfig.thinkingConfig = { thinkingBudget: 4096 };
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
        generationConfig: genConfig
      })
    });

    if (response.status === 429) {
      throw { status: 429, message: 'Quota Exceeded / Rate Limit' };
    }

    if (!response.ok) {
      throw new Error(`API Error (${modelToUse}): ${response.statusText}`);
    }

    const resJson = await response.json();
    return { data: resJson, modelUsed: modelToUse };
  };

  try {
    let resultPayload: { data: any; modelUsed: string };

    try {
      resultPayload = await executeApiCall(currentModel);
    } catch (err: any) {
      if (err?.status === 429) {
        console.warn(`[Auto-Rotate] HTTP 429 hit for ${currentModel}. Initiating model rotation...`);
        
        if (currentModel !== 'gemini-3.5-flash-lite') {
          markModelExhausted(currentModel);
          currentModel = 'gemini-3.5-flash-lite';
          rotationNote = `Model ${preferredModel} exceeded daily API quota (20 RPD). Auto-rotated to Gemini 3.5 Flash-Lite (will reset tomorrow).`;
          resultPayload = await executeApiCall(currentModel);
        } else {
          const altModel = !isModelExhausted('gemini-3.5-flash') ? 'gemini-3.5-flash' : 'gemini-3.6-flash';
          rotationNote = `Temporary rate limit encountered on Gemini 3.5 Flash-Lite. Auto-rotated temporarily to ${altModel}.`;
          resultPayload = await executeApiCall(altModel);
        }
      } else {
        throw err;
      }
    }

    const rawText = resultPayload.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error('Invalid response format');
    }

    const parsed = JSON.parse(rawText) as EvaluationResult;
    if (parsed.transcribedSpeech && (parsed.transcribedSpeech.toLowerCase().includes('no speech') || parsed.transcribedSpeech.toLowerCase().includes('không nghe thấy'))) {
      parsed.isError = true;
      parsed.pass = false;
    }

    if (rotationNote) {
      parsed.rotatedModelNotification = rotationNote;
    }

    lastEvaluationDebugLog = {
      timestamp: new Date().toLocaleTimeString(),
      systemPrompt: `MODEL USED: ${resultPayload.modelUsed} | THINKING: ${selectedThinking}\n\n${SYSTEM_PROMPT}`,
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
      transcribedSpeech: '(Audio evaluation error)',
      rotatedModelNotification: rotationNote
    };
    lastEvaluationDebugLog = {
      timestamp: new Date().toLocaleTimeString(),
      systemPrompt: `MODEL: ${currentModel} | THINKING: ${selectedThinking}\n\n${SYSTEM_PROMPT}`,
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
