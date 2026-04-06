const llmService = require("./llm-service");
const toolExecutor = require("./tool-executor");

/**
 * Simple orchestrator implementing PLAN -> ACT -> OBSERVE loop.
 * Accepts { userId, message, context } and runs up to maxSteps.
 */
async function orchestrate({ userId, message, context = {}, maxSteps = 6 }) {
  const logs = [];
  let lastObservation = null;
  try {
    for (let step = 0; step < maxSteps; step++) {
      logs.push({
        step,
        phase: "plan",
        prompt: message,
        observation: lastObservation,
      });

      // Build prompt for LLM: ask for single JSON action
      const prompt = `You are an orchestrator. Given the user message and previous observation, decide the next single JSON action to take. Respond with a single valid JSON object only.\nUser message:\n${String(
        message,
      )}\nPrevious observation:\n${String(lastObservation || "")}\n\nValid actions: run_terminal, write_files, invoke_registered_tool, complete, respond. Format: {"action":"action_name","data":{}}`;

      const resp = await llmService.generate(userId, {
        prompt,
        max_tokens: 800,
      });
      const text = String((resp && (resp.text || resp)) || "").trim();
      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        // try to extract JSON block
        const m = text.match(/\{[\s\S]*\}/);
        if (m) {
          try {
            parsed = JSON.parse(m[0]);
          } catch (e2) {
            return {
              success: false,
              error: "LLM returned non-JSON action",
              raw: text,
              logs,
            };
          }
        } else {
          return {
            success: false,
            error: "LLM returned non-JSON action",
            raw: text,
            logs,
          };
        }
      }

      if (!parsed || !parsed.action) {
        return {
          success: false,
          error: "No action produced by LLM",
          parsed,
          logs,
        };
      }

      const action = String(parsed.action || "");
      const data = parsed.data || {};
      logs.push({ step, phase: "act", action, data });

      if (action === "complete") {
        return { success: true, action: "complete", result: data, logs };
      }

      if (action === "respond") {
        // LLM asks to respond with content in data.message
        return {
          success: true,
          action: "respond",
          result: { message: data.message || "" },
          logs,
        };
      }

      // Execute tool via tool-executor
      const execRes = await toolExecutor.executeTool({
        action,
        data,
        userId,
        ctx: context,
      });
      logs.push({ step, phase: "observe", execRes });

      if (!execRes || execRes.ok === false) {
        // feed error back into next step
        lastObservation = `ERROR: ${execRes && execRes.error ? execRes.error : "unknown"}`;
      } else {
        lastObservation = JSON.stringify(execRes.result || execRes);
      }

      // continue to next step
    }
    return { success: false, error: "max_steps_exceeded", logs };
  } catch (err) {
    return {
      success: false,
      error: String(err && err.message ? err.message : err),
      logs,
    };
  }
}

module.exports = {
  orchestrate,
};
