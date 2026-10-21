import Anthropic from "@anthropic-ai/sdk";
import type { AskModel, ModelResponse } from "./ask";

// The real model, called through Anthropic's official SDK. The model name is a setting (ASK_MODEL) so it can be
// changed without touching code; claude-opus-5-5 is the default, and a cheaper model such as claude-haiku-5-5 can
// be used for a free demo.
export const DEFAULT_ASK_MODEL = "claude-opus-5-5";

export function createAnthropicModel(apiKey: string, modelName: string = DEFAULT_ASK_MODEL): AskModel {
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 60_000 });
  return {
    async create({ system, messages, tools }) {
      const response = await client.messages.create({
        model: modelName,
        // Answers are a few sentences, but the model's own reasoning also counts against this ceiling.
        max_tokens: 4000,
        // Low effort: short factual answers over small tool results do not need long reasoning, and it keeps cost down.
        output_config: { effort: "low" },
        system,
        tools: tools as Anthropic.Tool[],
        messages: messages as Anthropic.MessageParam[],
      });
      return { content: response.content as unknown as ModelResponse["content"], stop_reason: response.stop_reason };
    },
  };
}
