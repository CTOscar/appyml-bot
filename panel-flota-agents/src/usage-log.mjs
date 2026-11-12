// Telemetría del sistema: tokens y latencia por agente (Fase 2 del prototipo).
export async function logUsage(pool, row) {
  try {
    await pool.query(
      `INSERT INTO agent_usage_log
        (user_id, agent, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
         tool_calls, iterations, stop_reason, latency_ms, ok)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        row.userId ?? null, row.agent, row.model, row.inputTokens, row.outputTokens,
        row.cacheReadTokens, row.cacheWriteTokens, row.toolCalls, row.iterations,
        row.stopReason ?? null, row.latencyMs, row.ok ? 1 : 0,
      ],
    );
  } catch (e) {
    // Perder un registro de uso nunca debe tumbar la respuesta al usuario.
    console.error('[usage] no se pudo registrar:', e.message);
  }
}
