export async function onRequestGet({ env }) {
  const config = readAiConfig(env);
  return json({
    ok: true,
    provider: config.provider,
    model: config.model,
    hasArtificialIntelligenceApiKey: Boolean(config.apiKey),
    betaAccessEnabled: Boolean(env.BETA_ACCESS_CODE),
    adminAccessEnabled: Boolean(env.ADMIN_ACCESS_CODE || env.OWNER_ACCESS_CODE),
    applicationStorageEnabled: Boolean(env.DB),
    resumeStorageEnabled: Boolean(env.DB)
  });
}

function readAiConfig(env) {
  return {
    provider: (env.ARTIFICIAL_INTELLIGENCE_PROVIDER || env.AI_PROVIDER || "openai").toLowerCase(),
    apiKey: env.ARTIFICIAL_INTELLIGENCE_API_KEY || env.AI_API_KEY || env.OPENAI_API_KEY,
    model:
      env.ARTIFICIAL_INTELLIGENCE_MODEL ||
      env.AI_MODEL ||
      env.OPENAI_MODEL ||
      "gpt-5.4-mini"
  };
}

function json(payload, status = 200) {
  return Response.json(payload, { status });
}
