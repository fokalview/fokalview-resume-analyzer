export async function onRequestGet({ env }) {
  const config = readAiConfig(env);
  return json({
    ok: true,
    provider: config.provider,
    model: config.model,
    cloudflareAiModel: config.cloudflareModel,
    cloudflareAiEnabled: config.cloudflareAiEnabled,
    dailyAnalysisLimit: readDailyAnalysisLimit(env),
    hasArtificialIntelligenceApiKey: Boolean(config.apiKey),
    betaAccessEnabled: Boolean(env.BETA_ACCESS_CODE),
    adminAccessEnabled: Boolean(env.ADMIN_ACCESS_CODE || env.OWNER_ACCESS_CODE),
    applicationStorageEnabled: Boolean(env.DB),
    resumeStorageEnabled: Boolean(env.DB)
  });
}

function readDailyAnalysisLimit(env) {
  const configured = Number.parseInt(String(env.DAILY_ANALYSIS_LIMIT || "10"), 10);
  return Number.isFinite(configured) && configured > 0 ? Math.min(configured, 10000) : 10;
}

function readAiConfig(env) {
  const apiKey = env.ARTIFICIAL_INTELLIGENCE_API_KEY || env.AI_API_KEY || env.OPENAI_API_KEY;
  const requestedProvider = env.ARTIFICIAL_INTELLIGENCE_PROVIDER || env.AI_PROVIDER;
  return {
    provider: (requestedProvider || (!apiKey && env.AI ? "cloudflare-workers-ai" : "openai")).toLowerCase(),
    apiKey,
    model:
      env.ARTIFICIAL_INTELLIGENCE_MODEL ||
      env.AI_MODEL ||
      env.OPENAI_MODEL ||
      "gpt-5.4-mini",
    cloudflareModel: env.CLOUDFLARE_AI_MODEL || "@cf/meta/llama-3.1-8b-instruct",
    cloudflareAiEnabled: Boolean(env.AI)
  };
}

function json(payload, status = 200) {
  return Response.json(payload, { status });
}
