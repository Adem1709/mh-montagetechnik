// FILE GUIDE (FRONTEND JS ONLY)
// Ndrysho këtu vetëm UI:
// - mobile menu
// - reveal animations
// - lightbox
// - cookie banner UI
// Backend nuk preket nga ky file.

// Footer year
document.getElementById("year")?.appendChild(document.createTextNode(String(new Date().getFullYear())));

// Mobile menu (animated)
(() => {
  const burger = document.querySelector(".burger");
  const mobile = document.getElementById("mobileMenu");
  if (!burger || !mobile) return;

  burger.addEventListener("click", () => {
    const open = mobile.classList.contains("is-open");
    mobile.classList.toggle("is-open", !open);
    burger.setAttribute("aria-expanded", String(!open));
  });

  mobile.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => {
      mobile.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
    });
  });
})();

// Scroll reveal
(() => {
  const els = document.querySelectorAll(".reveal");
  if (!els.length) return;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add("is-in");
      });
    },
    { threshold: 0.15 }
  );
  els.forEach((el) => io.observe(el));
})();

// Interactive demos: toggle animation
(() => {
  const toggles = document.querySelectorAll(".js-toggle");
  const btns = document.querySelectorAll(".js-demo-btn");

  function toggle(el) { el.classList.toggle("is-on"); }

  toggles.forEach((el) => {
    el.addEventListener("click", () => toggle(el));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle(el);
      }
    });
  });

  btns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = btn.getAttribute("data-target");
      const el = document.querySelector(`.demo--${t}`);
      if (el) toggle(el);
    });
  });
})();

// Cookie consent (TTDSG/DSGVO) + Google Analytics load only on consent
(() => {
  const banner = document.getElementById("cookie-banner");
  if (!banner) return;

  const analyticsToggle = document.getElementById("cookie-analytics");
  const btnAccept = banner.querySelector('[data-cookie="accept-all"]');
  const btnReject = banner.querySelector('[data-cookie="reject-all"]');
  const btnSave = banner.querySelector('[data-cookie="save"]');

  const gaId = (window.SITE_GA_ID || "").trim();

  function loadAnalytics() {
    if (!gaId || gaId === "G-XXXXXXX") return;
    if (document.getElementById("ga-gtag")) return;

    const s1 = document.createElement("script");
    s1.id = "ga-gtag";
    s1.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
    s1.async = true;
    document.head.appendChild(s1);

    window.dataLayer = window.dataLayer || [];
    function gtag(){ window.dataLayer.push(arguments); }
    gtag("js", new Date());
    gtag("config", gaId, { anonymize_ip: true });
  }

  function saveConsent(consentObj) {
    localStorage.setItem("cookieConsentV1", JSON.stringify(consentObj));
  }
  function readConsent() {
    try { return JSON.parse(localStorage.getItem("cookieConsentV1") || "null"); }
    catch { return null; }
  }
  function hide() { banner.hidden = true; }
  function show() { banner.hidden = false; }

  const existing = readConsent();
  if (!existing) {
    // default toggles OFF for analytics
    analyticsToggle.checked = false;
    show();
  } else {
    analyticsToggle.checked = !!existing.analytics;
    if (existing.analytics) loadAnalytics();
  }

  btnAccept?.addEventListener("click", () => {
    analyticsToggle.checked = true;
    saveConsent({ necessary: true, analytics: true, ts: Date.now() });
    hide();
    loadAnalytics();
  });

  btnReject?.addEventListener("click", () => {
    analyticsToggle.checked = false;
    saveConsent({ necessary: true, analytics: false, ts: Date.now() });
    hide();
  });

  btnSave?.addEventListener("click", () => {
    saveConsent({ necessary: true, analytics: !!analyticsToggle.checked, ts: Date.now() });
    hide();
    if (analyticsToggle.checked) loadAnalytics();
  });
})();

// Contact form submit (AJAX) with CSRF
(() => {
  const form = document.querySelector("[data-contact-form]");
  if (!form) return;

  const statusEl = document.getElementById("contactStatus");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    statusEl.textContent = "Senden…";

    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json", "csrf-token": payload._csrf || (window.CSRF_TOKEN || "") },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        statusEl.textContent = "Danke! Ihre Anfrage wurde gesendet.";
        form.reset();
      } else {
        statusEl.textContent = "Fehler beim Senden. Bitte später erneut versuchen.";
      }
    } catch (err) {
      statusEl.textContent = "Fehler beim Senden. Bitte später erneut versuchen.";
    }
  });
})();



// Lightbox (gallery/project)
(() => {
  const links = Array.from(document.querySelectorAll("a.lightbox"));
  if (!links.length) return;

  const images = links.map((a) => a.getAttribute("href"));
  let idx = 0;

  const overlay = document.createElement("div");
  overlay.className = "lb";
  overlay.innerHTML = `
    <div class="lb__backdrop" data-lb="close"></div>
    <div class="lb__panel" role="dialog" aria-modal="true" aria-label="Bildvorschau">
      <button class="lb__btn lb__btn--close" data-lb="close" aria-label="Schließen">✕</button>
      <button class="lb__btn lb__btn--prev" data-lb="prev" aria-label="Vorheriges">‹</button>
      <img class="lb__img" alt="Projektbild" />
      <button class="lb__btn lb__btn--next" data-lb="next" aria-label="Nächstes">›</button>
      <div class="lb__meta"><span class="lb__count"></span></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const imgEl = overlay.querySelector(".lb__img");
  const countEl = overlay.querySelector(".lb__count");

  function render() {
    imgEl.src = images[idx];
    countEl.textContent = `${idx + 1} / ${images.length}`;
  }
  function openAt(i) {
    idx = i;
    render();
    overlay.classList.add("is-open");
    document.documentElement.style.overflow = "hidden";
  }
  function close() {
    overlay.classList.remove("is-open");
    document.documentElement.style.overflow = "";
  }
  function next() { idx = (idx + 1) % images.length; render(); }
  function prev() { idx = (idx - 1 + images.length) % images.length; render(); }

  links.forEach((a, i) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      openAt(i);
    });
  });

  overlay.addEventListener("click", (e) => {
    const action = e.target?.getAttribute?.("data-lb");
    if (action === "close") close();
    if (action === "next") next();
    if (action === "prev") prev();
  });

  window.addEventListener("keydown", (e) => {
    if (!overlay.classList.contains("is-open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowRight") next();
    if (e.key === "ArrowLeft") prev();
  });
})();


// door design filters
(() => {
  const buttons = document.querySelectorAll("[data-door-filter]");
  const cards = document.querySelectorAll(".door-design");
  if (!buttons.length || !cards.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("is-filter-active"));
      btn.classList.add("is-filter-active");

      const filter = btn.getAttribute("data-door-filter");
      cards.forEach((card) => {
        const color = card.getAttribute("data-color") || "";
        const glass = card.getAttribute("data-glass") || "";
        const hay = `${color} ${glass}`;

        if (filter === "all" || hay.includes(filter)) {
          card.style.display = "";
        } else {
          card.style.display = "none";
        }
      });
    });
  });
})();

// prefill contact form with clicked product/design
(() => {
  const links = document.querySelectorAll("[data-prefill-product]");
  if (!links.length) return;

  links.forEach((link) => {
    link.addEventListener("click", () => {
      localStorage.setItem("prefillProduct", link.getAttribute("data-prefill-product") || "");
    });
  });

  const form = document.querySelector("[data-contact-form]");
  const messageField = form?.querySelector('textarea[name="message"]');
  const saved = localStorage.getItem("prefillProduct");
  if (form && messageField && saved) {
    messageField.value = `Ich interessiere mich für: ${saved}\n\n` + (messageField.value || "");
    localStorage.removeItem("prefillProduct");
  }
})();

// Welcome popup (show once per browser)
(() => {
  const popup = document.getElementById("welcomePopup");
  const backdrop = document.getElementById("popupBackdrop");
  const closeBtn = document.getElementById("popupClose");
  
  if (!popup) return;

  const hasSeenPopup = localStorage.getItem("hasSeenWelcomePopup");
  
  // Show popup if user hasn't seen it
  if (!hasSeenPopup) {
    setTimeout(() => {
      popup.classList.add("is-open");
      localStorage.setItem("hasSeenWelcomePopup", "true");
    }, 800);
  }

  // Close popup functions
  const closePopup = () => {
    popup.classList.remove("is-open");
  };

  backdrop?.addEventListener("click", closePopup);
  closeBtn?.addEventListener("click", closePopup);

  // Close popup when clicking CTA links
  popup.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closePopup);
  });
})();
