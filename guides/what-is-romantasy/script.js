const spectrumData = [
  { name: "Fantasy-forward", description: "The quest, magic system or political conflict leads; romance enriches the journey.", move: "-22%, 12%" },
  { name: "Fantasy-leaning", description: "Fantasy drives the main plot, while the relationship carries meaningful stakes.", move: "-11%, 5%" },
  { name: "Balanced blend", description: "The magical stakes and relationship arc share the spotlight.", move: "0, 0" },
  { name: "Romance-leaning", description: "The relationship leads, but the fantasy world still changes how it develops.", move: "11%, -4%" },
  { name: "Romance-forward", description: "The love story is the engine; magic, creatures or kingdoms shape its obstacles.", move: "22%, -10%" }
];

const balanceRange = document.querySelector("#balance-range");
const spectrumIndex = document.querySelector("#spectrum-index");
const spectrumName = document.querySelector("#spectrum-name");
const spectrumDescription = document.querySelector("#spectrum-description");
const lens = document.querySelector(".observatory__lens");
const heartFillRect = document.querySelector("#heart-fill-rect");
const heartLevel = document.querySelector(".spectrum-heart__level");
const heartFillHeights = [10, 22, 34, 44, 64];

balanceRange.addEventListener("input", () => {
  const index = Number(balanceRange.value) - 1;
  const item = spectrumData[index];
  spectrumIndex.textContent = String(index + 1);
  spectrumName.textContent = item.name;
  spectrumDescription.textContent = item.description;
  const fillHeight = heartFillHeights[index];
  heartFillRect.setAttribute("y", String(64 - fillHeight));
  heartFillRect.setAttribute("height", String(fillHeight));
  heartLevel.textContent = `0${index + 1} / 05`;
  lens.style.transform = `translate(${item.move})`;
});

const atlasRail = document.querySelector("#atlas-rail");
const atlasCards = [...document.querySelectorAll(".atlas-card")];
const atlasPosition = document.querySelector("#atlas-position");
const atlasPrev = document.querySelector("#atlas-prev");
const atlasNext = document.querySelector("#atlas-next");

function closeAtlasCard(card) {
  const summaryButton = card.querySelector(".atlas-card__summary");
  card.classList.remove("is-open");
  summaryButton.setAttribute("aria-expanded", "false");
  summaryButton.querySelector(":scope > b").textContent = "+";
}

atlasCards.forEach((card) => {
  const summaryButton = card.querySelector(".atlas-card__summary");
  const details = card.querySelector(".atlas-card__details");

  summaryButton.addEventListener("click", () => {
    const opening = !card.classList.contains("is-open");
    atlasCards.forEach(closeAtlasCard);
    if (opening) {
      card.classList.add("is-open");
      summaryButton.setAttribute("aria-expanded", "true");
      summaryButton.querySelector(":scope > b").textContent = "×";
    }
  });

  details.addEventListener("click", (event) => {
    if (event.target.closest("a")) return;
    closeAtlasCard(card);
  });
});

function atlasCardWidth() {
  const card = atlasCards[0];
  return card ? card.getBoundingClientRect().width + 1 : atlasRail.clientWidth;
}

function updateAtlasPosition() {
  const maxScroll = Math.max(0, atlasRail.scrollWidth - atlasRail.clientWidth);
  const atStart = atlasRail.scrollLeft <= 2;
  const atEnd = maxScroll - atlasRail.scrollLeft <= 2;
  const index = atEnd
    ? atlasCards.length - 1
    : Math.min(atlasCards.length - 1, Math.max(0, Math.round(atlasRail.scrollLeft / atlasCardWidth())));
  atlasPosition.textContent = String(index + 1).padStart(2, "0");
  atlasPrev.disabled = atStart;
  atlasNext.disabled = atEnd;
}

atlasPrev.addEventListener("click", () => atlasRail.scrollBy({ left: -atlasCardWidth(), behavior: "smooth" }));
atlasNext.addEventListener("click", () => atlasRail.scrollBy({ left: atlasCardWidth(), behavior: "smooth" }));
atlasRail.addEventListener("scroll", updateAtlasPosition, { passive: true });
window.addEventListener("resize", updateAtlasPosition);
updateAtlasPosition();

const tropeItems = [...document.querySelectorAll(".trope-item")];

tropeItems.forEach((item) => {
  const button = item.querySelector(".trope-chip");
  button.addEventListener("click", () => {
    const opening = !item.classList.contains("is-open");
    tropeItems.forEach((other) => {
      other.classList.remove("is-open");
      other.querySelector(".trope-chip").setAttribute("aria-expanded", "false");
    });
    if (opening) {
      item.classList.add("is-open");
      button.setAttribute("aria-expanded", "true");
    }
  });
});

const steps = [...document.querySelectorAll(".trail-step")];
const result = document.querySelector(".trail-result");
const progress = document.querySelector("#trail-progress");
const stepLabel = document.querySelector("#trail-step-label");
const summary = document.querySelector("#trail-summary");
const reset = document.querySelector(".trail-reset");
const answers = [];
let currentStep = 0;

function renderTrail() {
  steps.forEach((step, index) => step.classList.toggle("is-active", index === currentStep));
  const complete = currentStep >= steps.length;
  result.hidden = !complete;
  progress.style.width = `${Math.min(((currentStep + 1) / steps.length) * 100, 100)}%`;
  stepLabel.textContent = `${String(Math.min(currentStep + 1, steps.length)).padStart(2, "0")} / ${String(steps.length).padStart(2, "0")}`;

  if (complete) {
    summary.replaceChildren(...answers.map((answer) => {
      const tag = document.createElement("span");
      tag.textContent = answer;
      return tag;
    }));
  }
}

steps.forEach((step, index) => {
  step.querySelectorAll("[data-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      answers[index] = button.dataset.choice;
      currentStep = index + 1;
      renderTrail();
    });
  });
});

reset.addEventListener("click", () => {
  answers.length = 0;
  currentStep = 0;
  renderTrail();
});

document.querySelectorAll(".myth-card").forEach((card) => {
  card.addEventListener("click", () => {
    const expanded = card.getAttribute("aria-expanded") === "true";
    card.setAttribute("aria-expanded", String(!expanded));
  });
});

document.querySelectorAll(".faq details").forEach((details) => {
  details.addEventListener("toggle", () => {
    if (!details.open) return;
    document.querySelectorAll(".faq details").forEach((other) => {
      if (other !== details) other.open = false;
    });
  });
});

const backToTop = document.querySelector(".back-to-top");
window.addEventListener("scroll", () => {
  backToTop.classList.toggle("is-visible", window.scrollY > window.innerHeight * 0.8);
}, { passive: true });
backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

// Section rail scroll-spy: highlight the guide-rail link for the section in view.
(function () {
  const links = [...document.querySelectorAll(".guide-rail__sections a")];
  if (!links.length) return;
  const sections = links
    .map((a) => document.getElementById(a.getAttribute("href").slice(1)))
    .filter(Boolean);
  const setActive = (id) => links.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === "#" + id));
  const spy = new IntersectionObserver((entries) => {
    const inView = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    if (inView[0]) setActive(inView[0].target.id);
  }, { rootMargin: "-130px 0px -55% 0px", threshold: 0 });
  sections.forEach((s) => spy.observe(s));
})();
