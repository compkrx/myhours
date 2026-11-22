# MyHours AI

The main AI page, lesson tutor, and roaming companion use the same selectable on-device model. They do not require a sign-in, provider account, API key, or server. Inference runs in the browser through [WebLLM](https://github.com/mlc-ai/web-llm) and WebGPU.

Available models:

- Gemma 3 · 1B — about 700 MB; recommended starting point.
- Gemma 2 · 2B — about 1.9 GB; needs more memory.
- Llama 3.2 · 1B — about 900 MB.

The first use downloads the selected model files from the model host and caches them in browser storage. Switching to a model that has not been used before downloads that model too. Later prompts run locally. WebLLM's [built-in model list](https://webllm.mlc.ai/models/) describes the browser model builds.

The AI page looks and behaves like a standard chat: conversations on the left, one model picker, and a composer. Chat history is saved in browser local storage while “Save chat history on this device” is on. Users can clear it from the chat rail. The optional “Add workspace context” control includes a small, bounded set of local tasks, classes, projects, events and notes in the browser prompt. It is off by default. Lesson tutoring shares the chosen model and can include the lesson text. The companion shares the model choice and asks separately before adding personal records.

These are small text models, so response quality and speed vary with the Chromebook or computer. Local inference requires a current browser with WebGPU and enough available graphics memory. Image input is not supported by the three local text models. There is no server fallback if WebGPU is unavailable; the page shows the reason and leaves the rest of the app usable.

The system instructions tell the model to teach, plan, and answer clearly. The model has no tools that can create or change app records. A suggestion is only text; saving tasks, notes, lesson attempts, or calendar entries remains a separate user action.

The prior authenticated edge-function integration remains in the repository for future work, but the chat page, lesson tutor, and companion no longer call it or expose provider configuration.
