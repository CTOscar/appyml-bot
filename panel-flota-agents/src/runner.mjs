// Ciclo agente <-> herramientas (manual, sobre client.messages.create).
const MENSAJES = {
  refusal: 'No puedo ayudar con esa petición.',
  max_tokens: 'La respuesta se cortó por ser muy larga. ¿Puedes hacer una pregunta más específica?',
  iteraciones: 'No alcancé a terminar la consulta. Intenta de nuevo con una pregunta más concreta.',
};

const addUsage = (acc, u = {}) => {
  acc.inputTokens += u.input_tokens ?? 0;
  acc.outputTokens += u.output_tokens ?? 0;
  acc.cacheReadTokens += u.cache_read_input_tokens ?? 0;
  acc.cacheWriteTokens += u.cache_creation_input_tokens ?? 0;
};

// client: instancia de @anthropic-ai/sdk. bridge: McpBridge. agent: definición (src/agents/*).
// meta: contexto confiable que se inyecta a las herramientas (userId). El modelo no puede cambiarlo.
export async function runAgent({ client, bridge, agent, model, messages, meta }) {
  const t0 = Date.now();
  const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  const tools = bridge.anthropicTools(agent.tools);
  const convo = [...messages];
  let toolCalls = 0;
  let iterations = 0;

  const done = (text, stopReason, ok = true) => ({
    text, stopReason, ok, toolCalls, iterations, latencyMs: Date.now() - t0, ...usage,
  });

  while (iterations < agent.maxIterations) {
    iterations++;
    const res = await client.messages.create({
      model,
      max_tokens: agent.maxTokens,
      system: agent.system,
      tools,
      messages: convo,
      output_config: { effort: agent.effort },
    });
    addUsage(usage, res.usage);

    if (res.stop_reason === 'refusal') return done(MENSAJES.refusal, 'refusal', false);
    if (res.stop_reason === 'max_tokens') return done(MENSAJES.max_tokens, 'max_tokens', false);

    const usos = res.content.filter((b) => b.type === 'tool_use');
    if (res.stop_reason !== 'tool_use' || usos.length === 0) {
      const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
      return done(text || 'No tengo una respuesta para eso.', res.stop_reason);
    }

    convo.push({ role: 'assistant', content: res.content });
    toolCalls += usos.length;
    // Todos los resultados de un mismo turno van en UN solo mensaje de usuario.
    const resultados = await Promise.all(
      usos.map(async (u) => {
        if (!agent.tools.includes(u.name)) {
          return { type: 'tool_result', tool_use_id: u.id, is_error: true, content: 'Herramienta no permitida para este agente.' };
        }
        try {
          const r = await bridge.call(u.name, u.input, meta);
          return { type: 'tool_result', tool_use_id: u.id, is_error: r.isError, content: r.content };
        } catch (e) {
          console.error(`[tool ${u.name}]`, e.message);
          return { type: 'tool_result', tool_use_id: u.id, is_error: true, content: 'Error interno al consultar los datos.' };
        }
      }),
    );
    convo.push({ role: 'user', content: resultados });
  }
  return done(MENSAJES.iteraciones, 'max_iterations', false);
}
