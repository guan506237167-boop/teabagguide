(function () {
  const defaultBase = "https://console.shanyuegroup.com";
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function status(card, message, isError) {
    const node = card.querySelector("[data-paid-status]");
    if (!node) return;
    node.textContent = message;
    node.classList.toggle("is-error", Boolean(isError));
  }

  function collectInput(card) {
    return {
      source: card.getAttribute("data-paid-site") || "unknown",
      question: card.getAttribute("data-paid-question") || "Create a paid report.",
      page: window.location.pathname,
      userAgent: navigator.userAgent
    };
  }

  async function startCheckout(card) {
    const form = card.querySelector("[data-paid-form]");
    const emailInput = card.querySelector("[data-paid-email]");
    const button = card.querySelector("[data-paid-checkout]");
    const email = String(emailInput && emailInput.value || "").trim();
    if (!emailPattern.test(email)) {
      if (emailInput) {
        emailInput.focus();
        emailInput.setAttribute("aria-invalid", "true");
      }
      status(card, "Enter a valid email address so the report link can be delivered.", true);
      return;
    }
    if (emailInput) emailInput.removeAttribute("aria-invalid");
    const oldText = button ? button.textContent : "";
    if (button) {
      button.disabled = true;
      button.textContent = "Opening secure checkout...";
    }
    status(card, "Connecting to PayPal checkout...", false);
    try {
      const endpoint = card.getAttribute("data-paid-endpoint") || defaultBase + "/api/checkout/create";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: card.getAttribute("data-paid-provider") || "paypal",
          site: card.getAttribute("data-paid-site"),
          product: card.getAttribute("data-paid-product"),
          email,
          input: collectInput(card)
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "checkout_failed");
      const nextUrl = data.checkoutUrl || data.approvalUrl;
      if (!nextUrl) throw new Error("checkout_url_missing");
      window.location.href = nextUrl;
    } catch (error) {
      if (button) {
        button.disabled = false;
        button.textContent = oldText;
      }
      status(card, "Checkout failed: " + error.message, true);
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

