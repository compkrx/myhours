import { describe, expect, it, vi } from "vitest";
import type { ChatCompletionMessageParam } from "@mlc-ai/web-llm";
import { LocalAI, type EngineLoader } from "../src/integrations/local-ai";

function testEngine() {
  const requests: unknown[] = [];
  const callbacks: Array<(report: { text: string }) => void> = [];
  const engine = {
    chat: {
      completions: {
        create: vi.fn(async (request: unknown) => {
          requests.push(request);
          return (async function* () {
            yield { choices: [{ delta: { content: "Hello " } }] };
            yield { choices: [{ delta: { content: "there." } }] };
          })();
        }),
      },
    },
    setInitProgressCallback: vi.fn(
      (callback: (report: { text: string }) => void) =>
        callbacks.push(callback),
    ),
    reload: vi.fn(async () => undefined),
  };
  return { engine, requests, callbacks };
}

describe("browser-local AI", () => {
  it("streams a real completion request from the selected local model", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { gpu: { requestAdapter: vi.fn(async () => ({})) } },
      configurable: true,
    });
    const { engine, requests } = testEngine();
    const load = vi.fn(async () => engine as never) as unknown as EngineLoader;
    const ai = new LocalAI(load);
    const chunks: string[] = [];
    const progress = vi.fn();
    const messages: ChatCompletionMessageParam[] = [
      { role: "user", content: "Help me study." },
    ];
    for await (const chunk of ai.reply(
      "gemma3-1b-it-q4f16_1-MLC",
      messages,
      progress,
    ))
      chunks.push(chunk);
    expect(chunks.join("")).toBe("Hello there.");
    expect(load).toHaveBeenCalledOnce();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      model: "gemma3-1b-it-q4f16_1-MLC",
      stream: true,
    });
  });

  it("reloads the engine after the user switches models", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { gpu: { requestAdapter: vi.fn(async () => ({})) } },
      configurable: true,
    });
    const { engine } = testEngine();
    const load = vi.fn(async () => engine as never) as unknown as EngineLoader;
    const ai = new LocalAI(load);
    await ai.prepare("gemma3-1b-it-q4f16_1-MLC", vi.fn());
    await ai.prepare("gemma-2-2b-it-q4f16_1-MLC", vi.fn());
    expect(load).toHaveBeenCalledOnce();
    expect(engine.reload).toHaveBeenCalledWith("gemma-2-2b-it-q4f16_1-MLC");
  });

  it("explains why the model cannot run without WebGPU", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      configurable: true,
    });
    const ai = new LocalAI(vi.fn() as unknown as EngineLoader);
    await expect(
      ai.prepare("gemma3-1b-it-q4f16_1-MLC", vi.fn()),
    ).rejects.toThrow("does not support WebGPU");
  });

  it("explains when WebGPU exists but the device has no adapter", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { gpu: { requestAdapter: vi.fn(async () => null) } },
      configurable: true,
    });
    const ai = new LocalAI(vi.fn() as unknown as EngineLoader);
    await expect(
      ai.prepare("gemma3-1b-it-q4f16_1-MLC", vi.fn()),
    ).rejects.toThrow("did not provide a GPU adapter");
  });
});
