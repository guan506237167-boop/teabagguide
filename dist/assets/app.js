function getToolRoot(target) {
  return target?.closest(".hero-tool-card, .container") || document;
}

function recommendTea(event) {
  const root = getToolRoot(event?.currentTarget);
  const moment = root.querySelector("#moment").value;
  const flavor = root.querySelector("#flavor").value;
  const caffeine = root.querySelector("#caffeine").value;
  const result = root.querySelector("#result");

  const picks = {
    floral: "chrysanthemum and goji tea bags",
    warm: "ginger, jujube, and cinnamon-style tea bags",
    fresh: "mint and lemongrass herbal tea bags",
    soft: "chamomile-style caffeine-free tea bags"
  };

  const note = caffeine === "none"
    ? "Start with blends clearly marked caffeine-free."
    : "Check the label carefully, because some blends include green or black tea.";

  result.innerHTML = `
    <h3>${picks[flavor]}</h3>
    <p>Best fit for <strong>${moment}</strong>. ${note}</p>
    <p>Compare ingredient order, aroma notes, packaging, and whether the sachets are individually wrapped. This is a buying guide, not medical advice.</p>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  const button = document.querySelector("[data-recommend]");
  if (button) button.addEventListener("click", recommendTea);
});
