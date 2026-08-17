(function () {
  const btn = document.getElementById("ai-search-btn");
  const input = document.getElementById("smart-search-input");

  if (!btn || !input) return;

  async function runSmartSearch() {
    const query = input.value.trim();
    if (!query) return;

    const originalIcon = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    btn.disabled = true;

    try {
      const res = await fetch("/ai/smart-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Smart search is unavailable right now.");
        return;
      }

      window.location.href = data.redirectUrl;
    } catch (err) {
      alert("Network error — please try again.");
    } finally {
      btn.innerHTML = originalIcon;
      btn.disabled = false;
    }
  }

  btn.addEventListener("click", runSmartSearch);
})();
