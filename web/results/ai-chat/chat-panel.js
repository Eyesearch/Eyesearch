/**
 * results/ai-chat — the conversational "AI Mode" panel.
 *
 * Streams POST /v1/chat (Server-Sent Events) and renders the answer as markdown
 * while it arrives. The first message is the query the user already typed; the
 * input box at the bottom keeps the same conversation going.
 */

import { t } from "../../menu/language-selector/lang-switcher.js";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A deliberately small markdown subset: code fences, bold, italics, links, lists. */
export function renderMarkdown(source) {
  const text = String(source || "");
  const parts = text.split(/```/);
  return parts
    .map((part, index) => {
      if (index % 2 === 1) {
        const body = part.replace(/^[a-zA-Z0-9+-]*\n/, "");
        return `<pre class="chat-code"><code>${escapeHtml(body)}</code></pre>`;
      }
      let html = escapeHtml(part);
      html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
      html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      html = html.replace(/(^|\W)\*([^*]+)\*/g, "$1<em>$2</em>");
      html = html.replace(
        /\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
      );
      html = html.replace(
        /(^|\s)(https?:\/\/[^\s<]+)/g,
        '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>'
      );
      // Group consecutive list items into a single <ul>.
      const blocks = html.split(/\n{2,}/).map((block) => {
        const trimmed = block.trim();
        if (!trimmed) return "";
        if (/^[-*]\s+/.test(trimmed)) {
          const items = trimmed
            .split("\n")
            .filter((line) => /^[-*]\s+/.test(line.trim()))
            .map((line) => `<li>${line.trim().replace(/^[-*]\s+/, "")}</li>`)
            .join("");
          return `<ul>${items}</ul>`;
        }
        return `<p>${trimmed.replace(/\n/g, "<br />")}</p>`;
      });
      return blocks.filter(Boolean).join("");
    })
    .join("");
}

/**
 * @param {HTMLElement} container
 * @param {{endpoint?: string, onSources?: (sources: object[]) => void}} options
 */
export function mountChatPanel(container, options = {}) {
  if (!container) throw new Error("mountChatPanel: container is required");

  const endpoint = options.endpoint || "/v1/chat";
  let controller = null;
  let messages = [];

  const root = document.createElement("section");
  root.className = "chat";
  root.setAttribute("aria-label", "AI Mode conversation");

  const log = document.createElement("div");
  log.className = "chat-log";
  log.setAttribute("role", "log");
  log.setAttribute("aria-live", "polite");

  const form = document.createElement("form");
  form.className = "chat-form";
  const input = document.createElement("textarea");
  input.className = "chat-input";
  input.rows = 1;
  input.setAttribute("aria-label", t("aiPlaceholder"));
  input.placeholder = t("aiPlaceholder");
  const send = document.createElement("button");
  send.type = "submit";
  send.className = "chat-send";
  send.textContent = "→";
  send.setAttribute("aria-label", t("aiPlaceholder"));
  form.append(input, send);
  root.append(log, form);
  container.appendChild(root);

  function bubble(role) {
    const element = document.createElement("div");
    element.className = `chat-msg chat-${role}`;
    const body = document.createElement("div");
    body.className = "chat-body";
    element.appendChild(body);
    log.appendChild(element);
    log.scrollTop = log.scrollHeight;
    return body;
  }

  function addSources(sources) {
    if (!sources || !sources.length) return;
    const wrap = document.createElement("div");
    wrap.className = "chat-sources";
    const label = document.createElement("span");
    label.className = "chat-sources-label";
    label.textContent = t("aiSources");
    wrap.appendChild(label);
    sources.slice(0, 6).forEach((source) => {
      const link = document.createElement("a");
      link.className = "chat-source";
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = source.title || source.url;
      wrap.appendChild(link);
    });
    log.appendChild(wrap);
    if (typeof options.onSources === "function") options.onSources(sources);
  }

  async function stream(query, history) {
    if (controller) controller.abort();
    controller = new AbortController();

    const answer = bubble("assistant");
    answer.innerHTML = `<span class="chat-typing">${t("aiThinking")}</span>`;
    let text = "";
    let first = true;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "text/event-stream" },
        body: JSON.stringify({ query, messages: history }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const event of events) {
          const line = event.split("\n").find((entry) => entry.startsWith("data:"));
          if (!line) continue;
          let payload;
          try {
            payload = JSON.parse(line.slice(5).trim());
          } catch (error) {
            continue;
          }
          if (payload.delta) {
            text += payload.delta;
            answer.innerHTML = renderMarkdown(text);
            if (first) {
              first = false;
              log.scrollTop = log.scrollHeight;
            }
          }
          if (payload.done) {
            answer.innerHTML = renderMarkdown(text);
            addSources(payload.sources);
          }
        }
      }
      if (!text) answer.innerHTML = renderMarkdown(t("aiModeOffline"));
    } catch (error) {
      if (error && error.name === "AbortError") return;
      answer.innerHTML = renderMarkdown(
        `${t("aiModeOffline")}\n\n\`${String(error && error.message ? error.message : error)}\``
      );
    }
  }

  /** Seed the conversation with the query the user already searched. */
  function ask(query) {
    const cleaned = String(query || "").trim();
    log.textContent = "";
    messages = [];
    if (!cleaned) return;
    const userBubble = bubble("user");
    userBubble.textContent = cleaned;
    messages.push({ role: "user", content: cleaned });
    stream(cleaned, messages.slice());
  }

  function followUp(question) {
    const cleaned = String(question || "").trim();
    if (!cleaned) return;
    const userBubble = bubble("user");
    userBubble.textContent = cleaned;
    messages.push({ role: "user", content: cleaned });
    stream(cleaned, messages.slice());
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value;
    input.value = "";
    input.style.height = "auto";
    followUp(value);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
  });

  return {
    ask,
    followUp,
    clear() {
      log.textContent = "";
      messages = [];
      if (controller) controller.abort();
    },
    focus() {
      input.focus();
    },
    get element() {
      return root;
    },
  };
}
