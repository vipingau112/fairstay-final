(function () {
  const bubble = document.getElementById("ai-chat-bubble");
  const win = document.getElementById("ai-chat-window");
  const closeBtn = document.getElementById("ai-chat-close");
  const form = document.getElementById("ai-chat-form");
  const input = document.getElementById("ai-chat-input");
  const messages = document.getElementById("ai-chat-messages");

  if (!bubble || !win) return;

  let history = [];

  bubble.addEventListener("click", () => win.classList.toggle("open"));
  closeBtn.addEventListener("click", () => win.classList.remove("open"));

  function addMessage(text, type) {
    const div = document.createElement("div");
    div.className = "ai-msg ai-msg-" + type;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    addMessage(text, "user");
    history.push({ role: "user", text });
    input.value = "";

    const loadingEl = addMessage("Thinking...", "loading");

    try {
      const res = await fetch("/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json();
      loadingEl.remove();

      if (!res.ok) {
        addMessage(data.error || "Something went wrong.", "error");
        return;
      }

      addMessage(data.reply, "bot");
      history.push({ role: "assistant", text: data.reply });
    } catch (err) {
      loadingEl.remove();
      addMessage("Network error — please try again.", "error");
    }
  });
})();
