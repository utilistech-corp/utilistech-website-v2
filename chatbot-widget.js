/**
 * Utilis Technologies AI Chatbot Widget
 * 
 * Embed on your site by adding this before </body>:
 * <script src="/chatbot-widget.js" data-api-url="https://utilistech-chatbot.azurewebsites.net/api/chat"></script>
 * 
 * Or with custom settings:
 * <script 
 *   src="/chatbot-widget.js" 
 *   data-api-url="https://utilistech-chatbot.azurewebsites.net/api/chat"
 *   data-position="right"
 *   data-welcome="Hi! I'm the Utilis Tech AI assistant. Ask me anything about our services."
 * ></script>
 */
(function () {
  "use strict";

  // Read config from script tag attributes
  const scriptTag = document.currentScript;
  const API_URL = scriptTag?.getAttribute("data-api-url") || "";
  const POSITION = scriptTag?.getAttribute("data-position") || "right";
  const WELCOME_MESSAGE =
    scriptTag?.getAttribute("data-welcome") ||
    "Hi! I'm the Utilis Tech AI assistant. Ask me anything about our AI integration services, IT infrastructure, or how we can help your business.";

  if (!API_URL) {
    console.error("Chatbot widget: data-api-url attribute is required.");
    return;
  }

  // ── State ──────────────────────────────────────────────────────────
  let isOpen = false;
  let isLoading = false;
  let messages = [{ role: "assistant", content: WELCOME_MESSAGE }];
  let clientMsgCount = 0;
  let clientMsgWindowStart = Date.now();
  const CLIENT_RATE_LIMIT = 8; // max messages per minute client-side
  const CLIENT_RATE_WINDOW = 60000;

  // ── Styles ─────────────────────────────────────────────────────────
  const styles = document.createElement("style");
  styles.textContent = `
    /* Reset and base */
    #ut-chatbot *, #ut-chatbot *::before, #ut-chatbot *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    /* Floating toggle button */
    #ut-chat-toggle {
      position: fixed;
      bottom: 24px;
      ${POSITION}: 24px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #1de9b6;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(29, 233, 182, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      z-index: 10000;
    }
    #ut-chat-toggle:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 28px rgba(29, 233, 182, 0.45);
    }
    #ut-chat-toggle svg {
      width: 26px;
      height: 26px;
      fill: #0d1117;
      transition: transform 0.2s ease;
    }
    #ut-chat-toggle.open svg.icon-chat { display: none; }
    #ut-chat-toggle.open svg.icon-close { display: block; }
    #ut-chat-toggle:not(.open) svg.icon-chat { display: block; }
    #ut-chat-toggle:not(.open) svg.icon-close { display: none; }

    /* Chat panel */
    #ut-chat-panel {
      position: fixed;
      bottom: 96px;
      ${POSITION}: 24px;
      width: 380px;
      max-width: calc(100vw - 32px);
      height: 520px;
      max-height: calc(100vh - 140px);
      background: #0d1117;
      border: 1px solid rgba(29, 233, 182, 0.2);
      border-radius: 16px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 10000;
      opacity: 0;
      transform: translateY(16px) scale(0.95);
      pointer-events: none;
      transition: opacity 0.25s ease, transform 0.25s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    #ut-chat-panel.open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }

    /* Header */
    #ut-chat-header {
      padding: 16px 20px;
      background: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
      border-bottom: 1px solid rgba(29, 233, 182, 0.15);
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }
    #ut-chat-header-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #1de9b6;
      flex-shrink: 0;
    }
    #ut-chat-header-title {
      color: #e6edf3;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.01em;
    }
    #ut-chat-header-subtitle {
      color: #8b949e;
      font-size: 12px;
      font-weight: 400;
    }

    /* Messages area */
    #ut-chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      scrollbar-width: thin;
      scrollbar-color: #30363d #0d1117;
    }
    #ut-chat-messages::-webkit-scrollbar { width: 6px; }
    #ut-chat-messages::-webkit-scrollbar-track { background: transparent; }
    #ut-chat-messages::-webkit-scrollbar-thumb {
      background: #30363d;
      border-radius: 3px;
    }

    /* Message bubbles */
    .ut-msg {
      max-width: 85%;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.5;
      word-wrap: break-word;
      white-space: pre-wrap;
    }
    .ut-msg-assistant {
      align-self: flex-start;
      background: #161b22;
      color: #e6edf3;
      border-bottom-left-radius: 4px;
    }
    .ut-msg-user {
      align-self: flex-end;
      background: #1de9b6;
      color: #0d1117;
      border-bottom-right-radius: 4px;
      font-weight: 500;
    }

    /* Typing indicator */
    .ut-typing {
      display: flex;
      gap: 4px;
      padding: 12px 14px;
      align-self: flex-start;
    }
    .ut-typing-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #8b949e;
      animation: ut-bounce 1.2s ease-in-out infinite;
    }
    .ut-typing-dot:nth-child(2) { animation-delay: 0.15s; }
    .ut-typing-dot:nth-child(3) { animation-delay: 0.3s; }
    @keyframes ut-bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-6px); }
    }

    /* Input area */
    #ut-chat-input-area {
      padding: 12px 16px;
      border-top: 1px solid rgba(29, 233, 182, 0.1);
      background: #0d1117;
      display: flex;
      gap: 8px;
      align-items: flex-end;
      flex-shrink: 0;
    }
    #ut-chat-input {
      flex: 1;
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 10px;
      padding: 10px 14px;
      color: #e6edf3;
      font-size: 14px;
      font-family: inherit;
      line-height: 1.4;
      resize: none;
      outline: none;
      max-height: 100px;
      transition: border-color 0.15s ease;
    }
    #ut-chat-input::placeholder { color: #6e7681; }
    #ut-chat-input:focus { border-color: rgba(29, 233, 182, 0.5); }
    #ut-chat-send {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: #1de9b6;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: opacity 0.15s ease;
    }
    #ut-chat-send:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    #ut-chat-send svg {
      width: 18px;
      height: 18px;
      fill: #0d1117;
    }

    /* Powered by footer */
    #ut-chat-footer {
      padding: 6px 16px 10px;
      text-align: center;
      flex-shrink: 0;
    }
    #ut-chat-footer a {
      color: #6e7681;
      font-size: 11px;
      text-decoration: none;
      transition: color 0.15s ease;
    }
    #ut-chat-footer a:hover { color: #1de9b6; }

    /* Mobile responsive */
    @media (max-width: 440px) {
      #ut-chat-panel {
        width: calc(100vw - 16px);
        ${POSITION}: 8px;
        bottom: 88px;
        height: calc(100vh - 120px);
        border-radius: 12px;
      }
      #ut-chat-toggle {
        bottom: 16px;
        ${POSITION}: 16px;
      }
    }
  `;
  document.head.appendChild(styles);

  // ── HTML ───────────────────────────────────────────────────────────
  const container = document.createElement("div");
  container.id = "ut-chatbot";
  container.innerHTML = `
    <button id="ut-chat-toggle" aria-label="Open chat">
      <svg class="icon-chat" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/>
      </svg>
      <svg class="icon-close" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    </button>
    <div id="ut-chat-panel">
      <div id="ut-chat-header">
        <div id="ut-chat-header-dot"></div>
        <div>
          <div id="ut-chat-header-title">Utilis Tech AI</div>
          <div id="ut-chat-header-subtitle">Ask me anything</div>
        </div>
      </div>
      <div id="ut-chat-messages"></div>
      <div id="ut-chat-input-area">
        <input id="ut-chat-hp" type="text" name="website" autocomplete="off" tabindex="-1" style="position:absolute;left:-9999px;opacity:0;height:0;width:0;" />
        <textarea id="ut-chat-input" placeholder="Type your question..." rows="1"></textarea>
        <button id="ut-chat-send" aria-label="Send message" disabled>
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
      <div id="ut-chat-footer">
        <a href="https://utilistech.co.uk" target="_blank">Powered by Utilis Tech</a>
      </div>
    </div>
  `;
  document.body.appendChild(container);

  // ── DOM refs ───────────────────────────────────────────────────────
  const toggle = document.getElementById("ut-chat-toggle");
  const panel = document.getElementById("ut-chat-panel");
  const messagesEl = document.getElementById("ut-chat-messages");
  const input = document.getElementById("ut-chat-input");
  const sendBtn = document.getElementById("ut-chat-send");

  // ── Render ─────────────────────────────────────────────────────────
  function renderMessages() {
    messagesEl.innerHTML = "";
    messages.forEach((msg) => {
      const div = document.createElement("div");
      div.className = `ut-msg ut-msg-${msg.role}`;
      div.textContent = msg.content;
      messagesEl.appendChild(div);
    });

    if (isLoading) {
      const typing = document.createElement("div");
      typing.className = "ut-typing";
      typing.innerHTML =
        '<div class="ut-typing-dot"></div><div class="ut-typing-dot"></div><div class="ut-typing-dot"></div>';
      messagesEl.appendChild(typing);
    }

    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function updateStreamingMessage(text) {
    const lastMsg = messagesEl.querySelector(".ut-msg:last-of-type");
    if (lastMsg && lastMsg.classList.contains("ut-msg-assistant")) {
      lastMsg.textContent = text;
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ── API call with streaming ────────────────────────────────────────
  async function sendMessage(userText) {
    if (isLoading || !userText.trim()) return;

    // Client-side rate limiting (first line of defence)
    const now = Date.now();
    if (now - clientMsgWindowStart > CLIENT_RATE_WINDOW) {
      clientMsgCount = 0;
      clientMsgWindowStart = now;
    }
    clientMsgCount++;
    if (clientMsgCount > CLIENT_RATE_LIMIT) {
      messages.push({ role: "assistant", content: "You're sending messages quite quickly. Please wait a moment before trying again." });
      renderMessages();
      return;
    }

    messages.push({ role: "user", content: userText.trim() });
    isLoading = true;
    renderMessages();

    // Prepare API messages (exclude welcome message from context)
    const apiMessages = messages
      .filter((_, i) => i > 0) // skip welcome message
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, _hp: document.getElementById("ut-chat-hp").value }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed (${response.status})`);
      }

      // Parse SSE response and extract full text
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) fullText += parsed.text;
            if (parsed.error) throw new Error(parsed.error);
          } catch (e) {
            if (e.message && e.message !== "Stream interrupted") { /* skip */ }
          }
        }
      }

      if (!fullText) {
        throw new Error("No response received");
      }

      // Typewriter effect — reveal text word by word
      isLoading = false;
      messages.push({ role: "assistant", content: "" });
      renderMessages();

      const words = fullText.split(/( )/);
      let displayed = "";
      let wordIndex = 0;

      await new Promise((resolve) => {
        function typeNext() {
          if (wordIndex >= words.length) {
            messages[messages.length - 1].content = fullText;
            resolve();
            return;
          }
          displayed += words[wordIndex];
          wordIndex++;
          messages[messages.length - 1].content = displayed;
          updateStreamingMessage(displayed);
          setTimeout(typeNext, 20);
        }
        typeNext();
      });

    } catch (error) {
      isLoading = false;
      messages.push({
        role: "assistant",
        content:
          "Sorry, something went wrong. Please try again or book a call with us directly.",
      });
      renderMessages();
      console.error("Chatbot error:", error);
    }
  }

  // ── Event listeners ────────────────────────────────────────────────
  toggle.addEventListener("click", () => {
    isOpen = !isOpen;
    toggle.classList.toggle("open", isOpen);
    panel.classList.toggle("open", isOpen);
    if (isOpen) {
      renderMessages();
      setTimeout(() => input.focus(), 300);
    }
  });

  input.addEventListener("input", () => {
    // Auto-resize textarea
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 100) + "px";
    sendBtn.disabled = !input.value.trim() || isLoading;
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) {
        const text = input.value;
        input.value = "";
        input.style.height = "auto";
        sendBtn.disabled = true;
        sendMessage(text);
      }
    }
  });

  sendBtn.addEventListener("click", () => {
    if (!sendBtn.disabled) {
      const text = input.value;
      input.value = "";
      input.style.height = "auto";
      sendBtn.disabled = true;
      sendMessage(text);
    }
  });

  // Initial render
  renderMessages();
})();
