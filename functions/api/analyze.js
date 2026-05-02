const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["score", "summary", "strengths", "improvements", "keywordAnalysis", "sections"],
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 6 },
    improvements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "priority"],
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          priority: { type: "string", enum: ["High", "Medium", "Low"] }
        }
      },
      minItems: 3,
      maxItems: 6
    },
    keywordAnalysis: {
      type: "object",
      additionalProperties: false,
      required: ["matched", "missing"],
      properties: {
        matched: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 12 },
        missing: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 12 }
      }
    },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "score", "note"],
        properties: {
          name: { type: "string" },
          score: { type: "integer", minimum: 0, maximum: 100 },
          note: { type: "string" }
        }
      },
      minItems: 4,
      maxItems: 8
    }
  }
};

export async function onRequestPost({ request, env }) {
  const config = readAiConfig(env);

  if (!config.apiKey) {
    return json(
      {
        error:
          "Missing ARTIFICIAL_INTELLIGENCE_API_KEY. Add it as an encrypted Pages secret and redeploy."
      },
      500
    );
  }

  try {
    const body = await request.json();
    const resumeText = String(body.resumeText || "").trim();
    const targetRole = String(body.targetRole || "").trim();
    const jobContext = String(body.jobContext || "").trim();

    if (resumeText.length < 200) {
      return json({ error: "Please upload or paste at least 200 characters of resume text." }, 400);
    }

    const analysis = await analyzeResume({ resumeText, targetRole, jobContext }, config);
    return json(analysis);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Analysis failed" }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}

async function analyzeResume({ resumeText, targetRole, jobContext }, config) {
  const prompt = [
    "Analyze the Resume against the Job Context for ATS readiness, impact, and fit.",
    "",
    "Steps:",
    "1. Extract core technical skills, soft skills, and requirements from Job Context.",
    "2. Cross-reference those terms against Resume.",
    "3. Put found terms in keywordAnalysis.matched and absent terms in keywordAnalysis.missing.",
    "4. Generate concise, specific improvement feedback.",
    "",
    `Target Role: ${targetRole || "Not specified"}`,
    "",
    "--- JOB CONTEXT ---",
    jobContext ? jobContext.slice(0, 12000) : "Not provided.",
    "",
    "--- RESUME TEXT ---",
    resumeText.slice(0, 50000)
  ].join("\n");

  if (config.provider === "openai") {
    return analyzeWithOpenAIResponses(prompt, config);
  }

  if (config.provider === "openai-compatible") {
    return analyzeWithOpenAICompatibleChat(prompt, config);
  }

  throw new Error(
    `Unsupported ARTIFICIAL_INTELLIGENCE_PROVIDER "${config.provider}". Use "openai" or "openai-compatible".`
  );
}

async function analyzeWithOpenAIResponses(prompt, config) {
  const response = await fetch(`${trimTrailingSlash(config.baseUrl)}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      instructions:
        "You are an expert ATS parser and resume evaluator. Output ONLY valid JSON matching the schema. Be concise, objective, and do not hallucinate experience.",
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "resume_analysis",
          strict: true,
          schema: responseSchema
        }
      }
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `AI provider request failed with ${response.status}`);
  }

  const outputText = payload.output_text || collectOutputText(payload);
  if (!outputText) throw new Error("AI provider returned no analyzable text.");
  return JSON.parse(outputText);
}

async function analyzeWithOpenAICompatibleChat(prompt, config) {
  const response = await fetch(`${trimTrailingSlash(config.baseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "system",
          content:
            "You are an expert ATS parser and resume evaluator. Return only valid JSON matching this shape: score number 0-100, summary string, strengths string array, improvements array of objects with title/detail/priority, keywordAnalysis object with matched and missing string arrays, sections array of objects with name/score/note. Be concise, objective, and do not hallucinate experience."
        },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `AI provider request failed with ${response.status}`);
  }

  const outputText = payload?.choices?.[0]?.message?.content;
  if (!outputText) throw new Error("AI provider returned no analyzable text.");
  return JSON.parse(outputText);
}

function readAiConfig(env) {
  return {
    provider: (env.ARTIFICIAL_INTELLIGENCE_PROVIDER || env.AI_PROVIDER || "openai").toLowerCase(),
    apiKey: env.ARTIFICIAL_INTELLIGENCE_API_KEY || env.AI_API_KEY || env.OPENAI_API_KEY,
    model:
      env.ARTIFICIAL_INTELLIGENCE_MODEL ||
      env.AI_MODEL ||
      env.OPENAI_MODEL ||
      "gpt-5.4-mini",
    baseUrl:
      env.ARTIFICIAL_INTELLIGENCE_BASE_URL ||
      env.AI_BASE_URL ||
      "https://api.openai.com/v1"
  };
}

function collectOutputText(payload) {
  return payload?.output
    ?.flatMap((item) => item.content || [])
    ?.filter((content) => content.type === "output_text")
    ?.map((content) => content.text)
    ?.join("");
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function json(payload, status = 200) {
  return Response.json(payload, { status });
}
