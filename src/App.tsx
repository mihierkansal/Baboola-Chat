import OpenAI from "openai";

import { createMemo, createSignal, createUniqueId, For, Show } from "solid-js";

//@ts-ignore
import markdownIt from "markdown-it";

import katex from "katex";

import "katex/dist/katex.min.css";
import { marked } from "marked";

declare var window: typeof Window & {
  copier: Record<string, Function>;
};
const renderMarkdown = async (markdown: string) => {
  // Convert Markdown to HTML
  const htmlContent = (
    await marked(
      markdown
        .replace(/(\\\(|\\\[)/g, "KATEX_START")
        .replace(/(\\\)|\\\])/g, "KATEX_END")
    )
  )
    .replace(/KATEX_START/g, "<span class='katex'>")
    .replace(/KATEX_END/g, "</span>");

  // Create a container to manipulate the HTML
  const container = document.createElement("div");
  container.innerHTML = htmlContent;

  // Render KaTeX expressions
  const katexElements = container.querySelectorAll(".katex");
  katexElements.forEach((element) => {
    const expression = element.textContent || "";
    if (expression) {
      element.innerHTML = ""; // Clear content
      try {
        katex.render(expression, element as HTMLElement); // Render KaTeX
      } catch (e) {
        console.error("KaTeX rendering error:", e);
      }
    }
  });

  const codeElements = container.querySelectorAll("pre");
  window.copier = {};
  codeElements.forEach((element) => {
    const codeContent = element.innerText;
    const elId = createUniqueId();

    let div = document.createElement("div");
    div.innerText = codeContent;

    window.copier[`copy${elId}`] = () => {
      navigator.clipboard.writeText(codeContent);
      console.log(codeContent);
    };
    element.innerHTML = `
      <div style="display:flex;justify-content:space-between;">
      <div>${element.className}</div>
      <div class="copycode-btn" onclick="window.copier['copy${elId}']()">Copy</div>
      </div>
    <hr/>
    <code>${div.innerHTML}</code>
    `;
  });

  return container.innerHTML;
};

function App() {
  console.log(import.meta.env.VITE_API_URL);
  const openai = new OpenAI({
    apiKey: import.meta.env.VITE_APIKEY,
    dangerouslyAllowBrowser: true,
  });

  const [message, setMessage] = createSignal("");

  const [messages, setMessages] = createSignal<
    { html: string; fromAI: boolean }[]
  >([]);

  const [loading, setLoading] = createSignal(false);

  const textareaRows = createMemo(() => {
    return Math.min(Math.max(2, message().split("\n").length), 5);
  });

  function request() {
    const completion = openai.chat.completions.create({
      model: "gpt-4o-mini",
      store: true,
      messages: messages().map((message) => {
        return {
          role: message.fromAI ? "assistant" : "user",
          content: message.html,
        };
      }),
    });

    return new Promise<string | null>((resolve, reject) => {
      completion
        .then((result) => {
          console.log(result.choices[0].message.content);
          resolve(result.choices[0].message.content);
        })
        .catch(() => {
          reject();
        });
    });
  }

  function submit() {
    const div = document.createElement("div");
    div.innerText = message();

    setMessages((v) => {
      v.push({
        html: div.innerHTML,
        fromAI: false,
      });
      return [...v];
    });

    setLoading(true);
    request().then(async (response) => {
      const r = response
        ? await renderMarkdown(response)
        : "Sorry, I can't answer your question.";
      setMessages((v) => {
        v.push({
          html: r,
          fromAI: true,
        });
        return [...v];
      });
      setLoading(false);
    });
    setMessage("");
  }

  return (
    <>
      <div
        style={{
          "margin-bottom": "9rem",
          padding: "1rem",
        }}
      >
        <For each={messages()}>
          {(message) => {
            return (
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  "justify-content": message.fromAI ? "flex-start" : "flex-end",
                }}
              >
                <div
                  innerHTML={message.html}
                  class={`message ${message.fromAI ? "incoming" : "outgoing"}`}
                />
              </div>
            );
          }}
        </For>
        <Show when={loading()}>
          <div class="message incoming">
            <div
              style={{
                display: "grid",
                "place-items": "center",
                height: "2rem",
              }}
            >
              <div class="dot-flashing"></div>
            </div>
          </div>
        </Show>
      </div>
      <div
        style={{
          position: "fixed",
          left: 0,
          bottom: 0,
          width: "100vw",
          padding: "0.5rem",
          background: "var(--bg-1)",
          "border-top-right-radius": "0.5rem",
          "border-top-left-radius": "0.5rem",
          "box-shadow": "0 0 5px #00000044",
        }}
      >
        <textarea
          value={message()}
          style={{
            display: "block",
            resize: "none",
            width: "100%",
          }}
          rows={textareaRows()}
          onInput={(e) => {
            setMessage(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key.toLowerCase() === "enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        ></textarea>
        <div
          style={{
            "margin-top": "0.5rem",
            display: "flex",
            gap: "0.5rem",
          }}
        >
          <button
            class="btn-secondary"
            style={{
              "flex-grow": 1,
            }}
            onClick={() => {
              setMessages([]);
            }}
          >
            New chat
          </button>
          <button
            class="btn-primary"
            style={{
              "flex-grow": 1,
            }}
            onClick={() => {
              submit();
            }}
            disabled={loading()}
          >
            Submit
          </button>
        </div>
      </div>
    </>
  );
}

export default App;
