import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

loadDotEnv();

const PORT = Number(process.env.API_PORT || 8787);
const AI_PROVIDER = (
  process.env.ARTIFICIAL_INTELLIGENCE_PROVIDER ||
  process.env.AI_PROVIDER ||
  "openai"
).toLowerCase();
const AI_API_KEY =
  process.env.ARTIFICIAL_INTELLIGENCE_API_KEY ||
  process.env.AI_API_KEY ||
  process.env.OPENAI_API_KEY;
const AI_MODEL =
  process.env.ARTIFICIAL_INTELLIGENCE_MODEL ||
  process.env.AI_MODEL ||
  process.env.OPENAI_MODEL ||
  "gpt-5.4-mini";
const AI_BASE_URL =
  process.env.ARTIFICIAL_INTELLIGENCE_BASE_URL ||
  process.env.AI_BASE_URL ||
  "https://api.openai.com/v1";

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
        matched: {
          type: "array",
          items: { type: "string" },
          minItems: 3,
          maxItems: 12
        },
        missing: {
          type: "array",
          items: { type: "string" },
          minItems: 3,
          maxItems: 12
        }
      },
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

const server = createServer(async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      provider: AI_PROVIDER,
      model: AI_MODEL,
      hasArtificialIntelligenceApiKey: Boolean(AI_API_KEY)
    });
    return;
  }

  if (req.url !== "/api/analyze" || req.method !== "POST") {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  if (!AI_API_KEY) {
    sendJson(res, 500, {
      error:
        "Missing ARTIFICIAL_INTELLIGENCE_API_KEY. Create .env from .env.example and restart the API server."
    });
    return;
  }

  try {
    const body = await readJson(req);
    const resumeText = String(body.resumeText || "").trim();
    const targetRole = String(body.targetRole || "").trim();
    const jobContext = String(body.jobContext || "").trim();

    if (resumeText.length < 200) {
      sendJson(res, 400, { error: "Please upload or paste at least 200 characters of resume text." });
      return;
    }

    const analysis = await analyzeResume({ resumeText, targetRole, jobContext });
    sendJson(res, 200, analysis);
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : "Analysis failed" });
  }
});

server.listen(PORT, () => {
  console.log(`Resume analyzer API listening on http://localhost:${PORT}`);
});

async function analyzeResume({ resumeText, targetRole, jobContext }) {
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

  if (AI_PROVIDER === "openai") {
    return analyzeWithOpenAIResponses(prompt);
  }

  if (AI_PROVIDER === "openai-compatible") {
    return analyzeWithOpenAICompatibleChat(prompt);
  }

  throw new Error(
    `Unsupported ARTIFICIAL_INTELLIGENCE_PROVIDER "${AI_PROVIDER}". Use "openai" or "openai-compatible".`
  );
}

async function analyzeWithOpenAIResponses(prompt) {
  const response = await fetch(`${trimTrailingSlash(AI_BASE_URL)}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_API_KEY}`
    },
    body: JSON.stringify({
      model: AI_MODEL,
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
    const message = payload?.error?.message || `AI provider request failed with ${response.status}`;
    throw new Error(message);
  }

  const outputText = payload.output_text || collectOutputText(payload);
  if (!outputText) {
    throw new Error("AI provider returned no analyzable text.");
  }

  return JSON.parse(outputText);
}

async function analyzeWithOpenAICompatibleChat(prompt) {
  const response = await fetch(`${trimTrailingSlash(AI_BASE_URL)}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AI_API_KEY}`
    },
    body: JSON.stringify({
      model: AI_MODEL,
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
    const message = payload?.error?.message || `AI provider request failed with ${response.status}`;
    throw new Error(message);
  }

  const outputText = payload?.choices?.[0]?.message?.content;
  if (!outputText) {
    throw new Error("AI provider returned no analyzable text.");
  }

  return JSON.parse(outputText);
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

function readJson(req) {
  return new Promise((resolveBody, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        req.destroy(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolveBody(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON request body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

function loadDotEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}
