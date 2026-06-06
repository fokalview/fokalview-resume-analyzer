import { applyDeterministicScoring } from "./scoring.js";

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["score", "summary", "profile", "jobQualifications", "strengths", "improvements", "keywordAnalysis", "sections"],
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    summary: { type: "string" },
    profile: {
      type: "object",
      additionalProperties: false,
      required: [
        "currentTitle",
        "careerLevel",
        "yearsExperienceEstimate",
        "industries",
        "skills",
        "workHistory",
        "education",
        "certifications",
        "projects",
        "languages",
        "locationSignals"
      ],
      properties: {
        currentTitle: { type: "string" },
        careerLevel: {
          type: "string",
          enum: ["Entry", "Early Career", "Mid Career", "Senior", "Leadership", "Unknown"]
        },
        yearsExperienceEstimate: { type: "number", minimum: 0, maximum: 60 },
        industries: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 12 },
        skills: {
          type: "object",
          additionalProperties: false,
          required: ["technical", "tools", "soft"],
          properties: {
            technical: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 30 },
            tools: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 30 },
            soft: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 20 }
          }
        },
        workHistory: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "company", "startDate", "endDate", "highlights"],
            properties: {
              title: { type: "string" },
              company: { type: "string" },
              startDate: { type: "string" },
              endDate: { type: "string" },
              highlights: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 6 }
            }
          },
          minItems: 0,
          maxItems: 12
        },
        education: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["institution", "credential", "field"],
            properties: {
              institution: { type: "string" },
              credential: { type: "string" },
              field: { type: "string" }
            }
          },
          minItems: 0,
          maxItems: 8
        },
        certifications: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 20 },
        projects: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 20 },
        languages: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 12 },
        locationSignals: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 12 }
      }
    },
    jobQualifications: {
      type: "object",
      additionalProperties: false,
      required: [
        "requiredSkills", "preferredSkills", "tools", "responsibilities", "education",
        "certifications", "experienceLevel", "yearsExperience", "employmentType", "location", "salary"
      ],
      properties: {
        requiredSkills: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 25 },
        preferredSkills: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 25 },
        tools: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 25 },
        responsibilities: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 15 },
        education: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 10 },
        certifications: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 10 },
        experienceLevel: { type: "string" },
        yearsExperience: { type: "string" },
        employmentType: { type: "string" },
        location: { type: "string" },
        salary: { type: "string" }
      }
    },
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
  const betaAccessCode = env.BETA_ACCESS_CODE || "";

  if (betaAccessCode && request.headers.get("X-Beta-Access-Code") !== betaAccessCode) {
    return json({ error: "Invalid beta access code." }, 401);
  }

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
    const lockedJobQualifications = normalizeLockedQualifications(body.jobQualifications);

    if (resumeText.length < 200) {
      return json({ error: "Please upload or paste at least 200 characters of resume text." }, 400);
    }

    const analysis = await analyzeResume({ resumeText, targetRole, jobContext }, config);
    return json(applyDeterministicScoring(analysis, {
      resumeText,
      targetRole,
      jobContext,
      jobQualifications: lockedJobQualifications || analysis.jobQualifications
    }));
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
    "1a. Fill jobQualifications using only explicit or strongly supported information from Job Context.",
    "2. Cross-reference those terms against Resume.",
    "3. Put found terms in keywordAnalysis.matched and absent terms in keywordAnalysis.missing.",
    "4. Extract a structured workforce-development profile from the resume only.",
    "5. Generate concise, specific improvement feedback.",
    "6. Do not treat your score values as authoritative; SagittaIQ applies a fixed scoring rubric after your analysis.",
    "",
    "Privacy and data-minimization rules:",
    "- Do not infer protected characteristics.",
    "- Do not include grades, GPAs, student IDs, birth dates, or full mailing addresses.",
    "- Use empty strings or empty arrays when a profile field is not present.",
    "- Keep education to institution, credential, and field only.",
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
            "You are an expert ATS parser and workforce-development resume evaluator. Return only valid JSON matching this shape: score number 0-100, summary string, profile object, jobQualifications object with requiredSkills, preferredSkills, tools, responsibilities, education, certifications, experienceLevel, yearsExperience, employmentType, location, salary, strengths string array, improvements array of objects with title/detail/priority, keywordAnalysis object with matched and missing string arrays, sections array of objects with name/score/note. Be concise, objective, avoid protected-characteristic inference, do not include grades, GPAs, student IDs, birth dates, or full mailing addresses, and do not hallucinate experience or job requirements."
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

function normalizeLockedQualifications(value) {
  if (!value || typeof value !== "object") return null;
  const list = (items) => Array.isArray(items) ? items.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 25) : [];
  return {
    requiredSkills: list(value.requiredSkills),
    preferredSkills: list(value.preferredSkills),
    tools: list(value.tools),
    responsibilities: list(value.responsibilities).slice(0, 15),
    education: list(value.education).slice(0, 10),
    certifications: list(value.certifications).slice(0, 10),
    experienceLevel: String(value.experienceLevel || "").trim().slice(0, 120),
    yearsExperience: String(value.yearsExperience || "").trim().slice(0, 120),
    employmentType: String(value.employmentType || "").trim().slice(0, 120),
    location: String(value.location || "").trim().slice(0, 200),
    salary: String(value.salary || "").trim().slice(0, 160)
  };
}

function json(payload, status = 200) {
  return Response.json(payload, { status });
}
