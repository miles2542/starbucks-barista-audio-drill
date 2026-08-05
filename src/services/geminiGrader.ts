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
  sizes?: string[];
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
- If a trainee omits any specific measurement, cup landmark, fill level, ratio, cup sleeve, or required action, set "pass": false immediately.
- Do NOT guess, assume, or award PASS for vague or incomplete statements (e.g. saying just "đổ đá" instead of "đá đến top logo").

CRITICAL STARBUCKS RECIPE CONTEXT & STRICT EVALUATION RULES:
1. CODE-SWITCHING & PHONETIC NORMALIZATION (VIETNAMESE + ENGLISH):
   - Trainee recites recipes by mixing English barista terms ("Hot Latte", "steam milk", "queue shot", "latte art") with Vietnamese words ("đầu tiên sẽ là", "rót sữa", "vạch cao nhất"). They will mainly be speaking in Vietnamese but will code-switch quite a lot. 
   - ASR PHONETIC RECOGNITION: Recognize English terms spoken with Vietnamese accent or phonetically transliterated, or misheard/not perfectly clear audio:
     * "hạt lờ tề" / "lờ tề" = Hot Latte / Latte
     * "hạt mocha" / "lờ mocha" = Hot Mocha / Mocha
     * "hạt caramel macchiato" / "mát ki a tô" = Hot Caramel Macchiato / Caramel Macchiato
     * "dieu tien" / "điều tiên" = đầu tiên
     * "kem" / "đá" / "phum" / "xirô" = syrup / ice / pumps
   - In "transcribedSpeech", transcribe into clean, natural Vietnamese + English terms.

2. SHOT QUEUEING DESTINATION OPTIONALITY:
   - Reciting whether shots are queued into a shot glass ("vào shot glass") or direct cup ("thẳng vào cốc") is 100% OPTIONAL EXTRA INFO, usually not needed as the Finsh & connect step has already specified where and when to pour the shots.
   - Do NOT require trainees to specify shot destination during the queue shots step.

3. STRICT MANDATORY SIZES:
   - The 4 sizes of Starbucks are Short, Tall, Grande, Venti. Most Hot drinks will have all 4 sizes (even though Short size is almost never really sold in reality), while most Iced drinks will have 3 sizes (Tall, Grande, Venti - no Short) only.
   - Almost always, sizes will be denoted and spoken as a string of numbers, e.g. for Hot Latte, the number of Queue shots will be 1 2 2 3, corresponding to 1 shot for Short, 2 for Tall, 2 for Grande, and 3 for Venti.
   - The required sizes for each drink are strictly defined by "validSizes" and "groundTruthSteps" in the provided groundTruthRecipe. If "validSizes" contains 3 sizes (e.g. ["Tall", "Grande", "Venti"]), the drink DOES NOT have a Short size. Do NOT require or demand a Short size for a 3-size drink!
   - If the groundTruthRecipe contains measurements for all 4 sizes, the trainee must specify all 4 sizes. If the trainee only say 3 numbers for a 4-size drink (e.g. trainee saying queue shots for Hot Latte is 2 2 3 - interpret that as last 3 sizes, omitting Short size), while the trainee is correct for Tall, Grande, Venti, they still missed Short size, so must still set "pass": false.

4. MANDATORY HOT DRINK CUP SLEEVE ("BỌC CỐC" / "ĐAI CHỐNG NÓNG"):
   - For ALL Hot Drinks (temperature: "hot"), trainee MUST explicitly state adding a cup sleeve ("bọc cốc" or "đai chống nóng"), and can say that at any point during the Finish & Connect step.
   - If trainee omits adding a cup sleeve / đai chống nóng for a Hot drink, set "pass": false!
   - Iced drinks DO NOT use a cup sleeve! NEVER fail an Iced drink for omitting a cup sleeve!

5. STRICT MANDATORY MEASUREMENTS & LANDMARKS (MUST FAIL IF VAGUE OR INEXACT) - Refer to "groundTruthSteps" in groundTruthRecipe for each particular drink, that is the supreme ground truth! Rely on "groundTruthSteps" above all pre-trained outside knowledge. Some of the commonly incorrect points of drinks might be like so:
   - Hot Cappuccino (C): MUST explicitly mention reducing milk pitcher size by 1 size ("giảm size" unless size is Short/Talll).
   - Iced Cappuccino (C): MUST say steam milk, as this is one of the rare iced drinks that steam milk, and pour milk to 6mm below middle line (usually other recipes are to top line, not middle).
   - Hot Mocha (M): MUST say don't pour the foam when pouring milk, as most others will pour both milk and the foam created after steaming milk.
   - Hot Caramel Macchiato (CM): MUST say pour both milk and foam to 12mm from rim (as the foam will help creates layers and acts as a foundation for the caramel sauce to stays on top instead of sinking to the bottom). Also note: if groundTruthSteps specifies multiple syrups (e.g. "Vanilla 1 2 3 4 AND Classic 1 2 3 4"), trainee MUST recite all syrups listed in groundTruthSteps.
   - Salted Caramel Cold Foam Dolce Espresso (SCDE): MUST add 3-4 sprinkles of cinnamon powder on foam.
   - Dolce Espresso (DE): this one actually can be more lenient, as in reality the Finish & connect step of this can be modified (and practiced in reality) to pump AD sauce, then add ice, then pour shots, then shake after all that instead of splitting into 2 separate shakes/swirl motions to save a ton of time. 
   - Coconut Dolce Espresso (CDE): MUST specify Coconut milk, not the default Whole milk.

6. ADAPTIVE FLEXIBILITY & SELF-CORRECTION (PASS ONLY IF FINAL CORRECTION IS 100% COMPLETE):
   - SELF-CORRECTION RULE: If trainee accidentally recites step B before step A, but immediately self-corrects ("thực ra phải làm step A trước rồi mới làm step B"), treat as PASS ONLY IF the final self-corrected answer contains all exact measurements, fill levels, etc. as specified by the groundTruthRecipe answer.

7. NO SPEECH DETECTED / SYSTEM ERROR HANDLING:
   - If the audio clip is silent, empty, or contains no audible voice, set "isError": true, "pass": false, "score": 0, and "feedback": "No speech audio detected. Please check microphone and speak clearly into the mic."

8. EVALUATION & WELL-FORMATTED STORE MANAGER FEEDBACK RULES:
   - Binary PASS or FAIL logic.
   - NO soft filler, NO comforting phrasing ("Good try", "Almost there").
   - ON PASS ("pass": true):
     * Set "feedback": "PASS. Recipe recalled correctly."
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
    validSizes: recipe.sizes || recipe.size,
    groundTruthSteps: recipe.groundTruthSteps || actions.find(a => a.step === 'Target Recipe Steps')?.action
  };

  const promptText = `Ground Truth Reference Recipe: ${JSON.stringify(cleanRecipePrompt, null, 2)}
Trainee Spoken Recalled Answer: ${JSON.stringify(actions.find(a => a.step === 'Trainee Spoken Recalled Answer')?.action || actions, null, 2)}
Evaluate execution strictly against groundTruthRecipe.groundTruthSteps!`;

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
        text: `Listen to the attached audio clip above of the trainee reciting the recipe in Vietnamese or English. 1) Transcribe what you hear into clean natural Vietnamese + English terms in "transcribedSpeech". 2) Evaluate against groundTruthRecipe strictly. If audio is silent/inaudible set "isError": true:\n${promptText}`
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
      throw new Error(`API Error (${modelToUse}): ${response.status} ${errText}`);
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
