(function () {
  const btn = document.getElementById("price-suggest-btn");
  const resultBox = document.getElementById("price-suggest-result");

  if (!btn) return;

  btn.addEventListener("click", async () => {
    const priceInput = document.getElementById("listing-price");
    const locationInput = document.getElementById("listing-location");
    const countryInput = document.getElementById("listing-country");

    const basePrice = Number(priceInput?.value);
    const location = locationInput?.value || "";
    const country = countryInput?.value || "";

    if (!basePrice) {
      resultBox.style.display = "block";
      resultBox.className = "mt-2 small text-danger";
      resultBox.textContent = "Enter a base price first.";
      return;
    }

    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Checking festival calendar...';

    try {
      const res = await fetch("/ai/price-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location, country, basePrice }),
      });
      const data = await res.json();

      resultBox.style.display = "block";
      if (!res.ok) {
        resultBox.className = "mt-2 small text-danger";
        resultBox.textContent = data.error || "Could not fetch a suggestion.";
        return;
      }

      resultBox.className = "mt-2 small text-secondary border rounded-3 p-2 bg-light";
      if (data.festival) {
        resultBox.innerHTML = `<strong>Suggested price: &#8377;${data.suggestedPrice.toLocaleString("en-IN")}</strong> (${Math.round((data.multiplier - 1) * 100)}% seasonal boost)<br>${data.reasoning}
          <br><button type="button" id="apply-suggested-price" class="btn btn-sm btn-dark rounded-pill mt-2">Apply this price</button>`;

        document.getElementById("apply-suggested-price").addEventListener("click", () => {
          priceInput.value = data.suggestedPrice;
        });
      } else {
        resultBox.textContent = data.reasoning;
      }
    } catch (err) {
      resultBox.style.display = "block";
      resultBox.className = "mt-2 small text-danger";
      resultBox.textContent = "Network error — please try again.";
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  });
})();
