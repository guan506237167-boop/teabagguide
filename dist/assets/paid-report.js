(function () {
  const base = (window.MCC_BASE_URL || "https://console.shanyuegroup.com").replace(/\/$/, "");
  const checkoutUrl = `${base}/api/checkout/create`;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function inputMap(card) {
    try {
      return JSON.parse(card.getAttribute("data-paid-inputs") || "{}");
    } catch {
      return {};
    }
  }

  function collectInput(card) {
    const root = card.closest(".container") || document;
    const input = {};
    Object.entries(inputMap(card)).forEach(([key, selector]) => {
      const field = root.querySelector(selector);
      input[key] = field ? String(field.value || field.textContent || "").trim() : "";
    });
    input.source = card.getAttribute("data-paid-site") || "herbal-tea";
    input.question = `Tea bags for ${input.moment || "daily use"}; flavor ${input.flavor || "not selected"}; caffeine ${input.caffeine || "not selected"}`;
    return input;
  }

  function setStatus(card, message, isError) {
    const status = card.querySelector("[data-paid-status]");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", Boolean(isError));
  }

  async function startCheckout(card) {
    const emailInput = card.querySelector("[data-paid-email]");
    const button = card.querySelector("[data-paid-checkout]");
    const email = String(emailInput && emailInput.value || "").trim();
    if (!emailPattern.test(email)) {
      if (emailInput) {
        emailInput.focus();
        emailInput.setAttribute("aria-invalid", "true");
      }
      setStatus(card, "Enter a valid email address for checklist delivery.", true);
      return;
    }
    if (emailInput) emailInput.removeAttribute("aria-invalid");
    const oldText = button ? button.textContent : "";
    if (button) {
      button.disabled = true;
      button.textContent = "Creating checkout...";
    }
    setStatus(card, "Connecting to secure checkout...", false);
    try {
      const response = await fetch(card.getAttribute("data-paid-endpoint") || checkoutUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: card.getAttribute("data-paid-provider") || "paypal",
          site: card.getAttribute("data-paid-site") || "herbal-tea",
          product: card.getAttribute("data-paid-product") || "buying-checklist",
          email,
          input: collectInput(card)
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "checkout_failed");
      window.location.href = data.checkoutUrl || data.approvalUrl;
    } catch (error) {
      if (button) {
        button.disabled = false;
        button.textContent = oldText;
      }
      setStatus(card, `Checkout failed: ${error.message}`, true);
    }
  }

  document.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-paid-form]");
    if (!form) return;
    event.preventDefault();
    const card = form.closest("[data-paid-report]");
    if (card) startCheckout(card);
  });
})();
