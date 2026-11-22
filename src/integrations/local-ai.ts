import type { ChatCompletionMessageParam } from "@mlc-ai/web-llm";
import type { InitProgressReport, MLCEngineInterface } from "@mlc-ai/web-llm";

export const localModels = [
  {
    id: "gemma3-1b-it-q4f16_1-MLC",
    name: "Gemma 3 · 1B",
    size: "about 700 MB",
  },
  {
    id: "gemma-2-2b-it-q4f16_1-MLC",
    name: "Gemma 2 · 2B",
    size: "about 1.9 GB",
  },
  {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    name: "Llama 3.2 · 1B",
    size: "about 900 MB",
  },
] as const;

export type LocalModelId = (typeof localModels)[number]["id"];
export type Progress = (report: InitProgressReport | { text: string }) => void;
export type EngineLoader = (
  model: LocalModelId,
  onProgress: Progress,
) => Promise<MLCEngineInterface>;

const browserLoader: EngineLoader = async (model, onProgress) => {
  const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
  return CreateMLCEngine(model, {
    initProgressCallback: onProgress,
    logLevel: "WARN",
  });
};

export class LocalAI {
  private engine?: MLCEngineInterface;
  private activeModel?: LocalModelId;

  constructor(private readonly load: EngineLoader = browserLoader) {}

  async prepare(model: LocalModelId, onProgress: Progress) {
    if (typeof navigator === "undefined" || !navigator.gpu) {
      throw new Error(
        "This browser does not support WebGPU. Open MyHours in an up-to-date version of Chrome or Edge on a device with WebGPU enabled.",
      );
    }
    if (this.engine && this.activeModel === model) return this.engine;
    if (!this.engine) {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        throw new Error(
          "WebGPU is available in this browser, but this device did not provide a GPU adapter. Try enabling hardware acceleration or use another device.",
        );
      }
    }
    if (this.engine) {
      this.engine.setInitProgressCallback(onProgress);
      await this.engine.reload(model);
      this.activeModel = model;
      return this.engine;
    }
    this.engine = await this.load(model, onProgress);
    this.activeModel = model;
    return this.engine;
  }

  async *reply(
    model: LocalModelId,
    messages: ChatCompletionMessageParam[],
    onProgress: Progress,
  ) {
    const engine = await this.prepare(model, onProgress);
    const stream = await engine.chat.completions.create({
      model,
      messages,
      temperature: 0.45,
      max_tokens: 900,
      stream: true,
    });
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (typeof text === "string" && text) yield text;
    }
  }
}

export const localAI = new LocalAI();
