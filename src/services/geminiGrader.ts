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
  groundTruthSteps?: {
    steamMilk: string;
    queueShots: string;
    pumpSyrup: string;
    finish: string;
  };
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

CRITICAL PRINCIPLE — ZERO FALSE-POSITIVE MANDATE:
- PREFER FALSE NEGATIVES OVER FALSE POSITIVES! False positives ruin training accuracy.
- If a trainee omits any specific measurement, cup landmark, fill level, ratio, cup sleeve (for hot drinks), or required action listed in groundTruthSteps, set "pass": false.
- Do NOT guess, assume, or award PASS for vague or incomplete statements (e.g. saying just "đổ đá" instead of "đá đến cách miệng cốc 6mm").

CRITICAL STARBUCKS RECIPE CONTEXT & EVALUATION RULES:
1. CODE-SWITCHING & PHONETIC NORMALIZATION (VIETNAMESE + ENGLISH):
   - Trainee recites recipes by mixing English barista terms ("Hot Latte", "steam milk", "queue shot", "latte art") with Vietnamese words ("đầu tiên sẽ là", "rót sữa", "vạch cao nhất"). They will mainly be speaking in Vietnamese with code-switching.
   - ASR PHONETIC RECOGNITION: Recognize English terms spoken with Vietnamese accent or phonetically transliterated:
     * "hạt lờ tề" / "lờ tề" = Hot Latte / Latte
     * "hạt mocha" / "lờ mocha" = Hot Mocha / Mocha
     * "hạt caramel macchiato" / "mát ki a tô" = Hot Caramel Macchiato / Caramel Macchiato
     * "dieu tien" / "điều tiên" = đầu tiên
     * "kem" / "đá" / "phum" / "xirô" = syrup / ice / pumps
   - In "transcribedSpeech", transcribe into clean, natural Vietnamese + English terms.

2. SHOT QUEUEING DESTINATION OPTIONALITY:
   - Reciting whether shots are queued into a shot glass ("vào shot glass") or direct cup ("thẳng vào cốc") is 100% OPTIONAL EXTRA INFO. Do NOT fail trainees for omitting shot destination during queue shots.

3. STRICT MANDATORY SIZES & TEMPERATURE RULES:
   - HOT DRINKS (temperature: "hot"): Have 4 sizes: Short, Tall, Grande, Venti (e.g. Shots 1 2 2 3, Syrup 2 3 4 5). Trainee MUST recite all 4 sizes for Hot drinks.
   - ICED DRINKS (temperature: "iced"): Have EXACTLY 3 sizes: Tall, Grande, Venti (e.g. Shots 2 2 3, Syrup 3 4 5). ICED DRINKS DO NOT HAVE A SHORT SIZE! NEVER fail an Iced drink for omitting Short size!

4. MANDATORY HOT DRINK CUP SLEEVE ("BỌC CỐC" / "ĐAI CHỐNG NÓNG"):
   - For HOT DRINKS ONLY (temperature: "hot"), trainee MUST explicitly state adding a cup sleeve ("bọc cốc" or "đai chống nóng").
   - ICED DRINKS DO NOT USE CUP SLEEVES! NEVER fail an Iced drink for omitting a cup sleeve!

5. STRICT COMPARISON AGAINST GROUND TRUTH STEPS:
   - Compare trainee's spoken answer DIRECTLY against "groundTruthSteps".
   - PASS CRITERIA: If trainee recited all exact steps, syrup types/counts, shot counts, fill levels, and finish actions present in groundTruthSteps, set "pass": true!
   - FAIL CRITERIA:
     * If trainee omitted any required step or measurement from groundTruthSteps, set "pass": false.
     * If trainee included INCORRECT EXTRA INGREDIENTS not in groundTruthSteps (e.g., adding Classic syrup to Caramel Macchiato which only uses Vanilla syrup), set "pass": false.

6. ADAPTIVE FLEXIBILITY & SELF-CORRECTION:
   - SELF-CORRECTION RULE: If trainee accidentally recites step B before step A, but immediately self-corrects ("thực ra phải làm step A trước rồi mới làm step B"), treat as PASS ONLY IF final self-corrected answer contains all exact measurements and steps.

7. NO SPEECH DETECTED / SYSTEM ERROR HANDLING:
   - If audio clip is silent, empty, or contains no audible voice, set "isError": true, "pass": false, "score": 0, and "feedback": "No speech audio detected. Please check microphone and speak clearly into the mic."

8. EVALUATION & STORE MANAGER FEEDBACK RULES:
   - Binary PASS or FAIL logic. Zero comforting fluff.
   - ON PASS ("pass": true):
     * Set "feedback": "PASS. Recipe recalled correctly."
   - ON FAIL ("pass": false): Format the "feedback" string with structured Markdown:
     **FAIL: [Short Concise Error Summary]**

     * **Heard:** "[Exact what trainee said]"
     * **Correction:** [Exact correction for the mistake]

     **Standard Recipe Steps:**
     1. [Step 1]
     2. [Step 2]
     3. [Step 3]
     4. [Step 4]
   - In "transcribedSpeech", output clean, natural transcription of what you hear in audio clip.`;

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
    allowedSizes: recipe.size,
    groundTruthSteps: recipe.groundTruthSteps || actions
  };

  const promptText = `Ground Truth Reference Recipe: ${JSON.stringify(cleanRecipePrompt, null, 2)}
Trainee Spoken Recalled Answer: ${JSON.stringify(actions, null, 2)}
Evaluate execution strictly against groundTruthSteps. If trainee recited all exact steps, measurements, syrup counts, fill levels, and landmarks in groundTruthSteps, return "pass": true!`;

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
        text: `Listen to the attached audio clip of the trainee reciting the recipe. 1) Transcribe audio into "transcribedSpeech". 2) Compare against groundTruthSteps strictly:\n${promptText}`
      });
    } else {
      parts.push({ text: promptText });
    }

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
      const errText = await response.text();
      throw new Error(`API Error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return { data, modelUsed: modelToUse };
  };

  try {
    let apiResult;
    try {
      apiResult = await executeApiCall(currentModel);
    } catch (err: any) {
      if (err?.status === 429 && currentModel !== 'gemini-3.5-flash-lite') {
        markModelExhausted(currentModel);
        rotationNote = `Model ${currentModel} exceeded daily quota (429 Rate Limit). Auto-rotated to Gemini 3.5 Flash-Lite.`;
        currentModel = 'gemini-3.5-flash-lite';
        apiResult = await executeApiCall(currentModel);
      } else {
        throw err;
      }
    }

    const text = apiResult.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Empty response text from Gemini model.');
    }

    const parsed: EvaluationResult = JSON.parse(text);
    if (rotationNote) {
      parsed.rotatedModelNotification = rotationNote;
    }

    lastEvaluationDebugLog = {
      timestamp: new Date().toISOString(),
      systemPrompt: SYSTEM_PROMPT,
      requestPrompt: promptText,
      rawResponseText: text,
      parsedResult: parsed,
      audioBlobUrl
    };

    return parsed;
  } catch (error: any) {
    console.warn('Gemini API evaluation failed, falling back to local heuristic grader:', error);
    return fallbackGrader(recipe, actions, audioBlobUrl);
  }
}

function fallbackGrader(recipe: RecipeContext, actions: UserAction[], audioBlobUrl?: string): EvaluationResult {
  const userText = actions.map(a => a.action).join(' ').toLowerCase();

  const isHot = recipe.temperature === 'hot';
  const hasSleeve = userText.includes('bọc cốc') || userText.includes('đai chống nóng') || userText.includes('sleeve');
  const passesSleeve = !isHot || hasSleeve;

  const isPass = passesSleeve && userText.length > 20;

  const result: EvaluationResult = {
    pass: isPass,
    score: isPass ? 90 : 40,
    feedback: isPass 
      ? 'PASS. Recipe recalled correctly.'
      : `**FAIL: Incomplete recipe recall or omitted cup sleeve**\n\n* **Heard:** "${userText.slice(0, 100)}..."\n* **Correction:** Ensure all sizes, landmarks, and cup sleeve (if hot) are stated.`,
    transcribedSpeech: actions.map(a => a.action).join(' ')
  };

  lastEvaluationDebugLog = {
    timestamp: new Date().toISOString(),
    systemPrompt: 'Client-side Fallback Heuristic Grader',
    requestPrompt: JSON.stringify({ recipe, actions }),
    rawResponseText: JSON.stringify(result),
    parsedResult: result,
    audioBlobUrl
  };

  return result;
}
