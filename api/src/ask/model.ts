import Anthropic from "@anthropic-ai/sdk";
import type { AskModel, ModelResponse } from "./ask";

// The real model, called through Anthropic's official SDK. The model name is a setting (ASK_MODEL) so it can be
// changed without touching code; the cheaper claude-haiku-5-5 is the default for the demo, and claude-opus-5-5 can
// be set for better answers.
export const DEFAULT_ASK_MODEL = "claude-haiku-5-5";

export function createAnthropicModel(apiKey: string, modelName: string = DEFAULT_ASK_MODEL): AskModel {
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 60_000 });
  return {
    async create({ system, messages, tools }) {
      const response = await client.messages.create({
        model: modelName,
        // Answers are a few sentences, but the model's own reasoning also counts against this ceiling.
        max_tokens: 4000,
        // Low effort: short factual answers over small tool results do not need long reasoning, and it keeps cost down.
        // (Not sent to Haiku: it is already the small, fast model, and the setting is not documented for it.)
        ...(modelName.includes("haiku") ? {} : { output_config: { effort: "low" as const } }),
        system,
        tools: tools as Anthropic.Tool[],
        messages: messages as Anthropic.MessageParam[],
      });
      return { content: response.content as unknown as ModelResponse["content"], stop_reason: response.stop_reason };
    },
  };
}
