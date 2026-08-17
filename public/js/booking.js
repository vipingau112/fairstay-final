(function () {
  const checkinInput = document.getElementById("booking-checkin");
  const checkoutInput = document.getElementById("booking-checkout");
  const breakdown = document.getElementById("booking-price-breakdown");
  const nightsEl = document.getElementById("booking-nights");
  const subtotalEl = document.getElementById("booking-subtotal");
  const totalEl = document.getElementById("booking-total");
  const priceMeta = document.getElementById("listing-price-value");

  if (!checkinInput || !checkoutInput) return;

  const pricePerNight = Number(document.body.dataset.listingPrice || 0);

  const todayStr = new Date().toISOString().split("T")[0];
  checkinInput.min = todayStr;

  function formatINR(n) {
    return "\u20B9" + Math.round(n).toLocaleString("en-IN");
  }

  function recalc() {
    if (!checkinInput.value) return;

    // check-out must be after check-in
    const minCheckout = new Date(checkinInput.value);
    minCheckout.setDate(minCheckout.getDate() + 1);
    checkoutInput.min = minCheckout.toISOString().split("T")[0];

    if (!checkoutInput.value || new Date(checkoutInput.value) <= new Date(checkinInput.value)) {
      breakdown.style.display = "none";
      return;
    }

    const nights = Math.round(
      (new Date(checkoutInput.value) - new Date(checkinInput.value)) / (1000 * 60 * 60 * 24)
    );
    const subtotal = nights * pricePerNight;

    nightsEl.textContent = nights;
    subtotalEl.textContent = formatINR(subtotal);
    totalEl.textContent = formatINR(subtotal);
    breakdown.style.display = "block";
  }

  checkinInput.addEventListener("change", recalc);
  checkoutInput.addEventListener("change", recalc);
})();
