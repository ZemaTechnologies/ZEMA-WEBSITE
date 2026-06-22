const analyticsKey = "zema_site_analytics_v1";
const sessionKey = "zema_site_session_v1";
const messagesKey = "zema_site_messages_v1";

const getAnalytics = () => {
  try {
    return JSON.parse(localStorage.getItem(analyticsKey)) || {};
  } catch {
    return {};
  }
};

const saveAnalytics = (data) => {
  localStorage.setItem(analyticsKey, JSON.stringify(data));
};

const getMessages = () => {
  try {
    return JSON.parse(localStorage.getItem(messagesKey)) || [];
  } catch {
    return [];
  }
};

const saveMessages = (messages) => {
  localStorage.setItem(messagesKey, JSON.stringify(messages));
};

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const readablePage = (path) => {
  const name = (path || location.pathname).split("/").pop() || "index.html";
  const labels = {
    "index.html": "Accueil",
    "offres.html": "Offres",
    "produits.html": "Produits",
    "process.html": "Process",
    "contact.html": "Contact",
    "admin.html": "Admin",
  };
  return labels[name] || name;
};

const getDeviceType = () => {
  const width = window.innerWidth;
  if (width < 720) return "Mobile";
  if (width < 1100) return "Tablette";
  return "Ordinateur";
};

const isAdminPage = location.pathname.endsWith("admin.html");

const track = (type, label) => {
  const data = getAnalytics();
  const now = new Date();
  const page = readablePage(location.pathname);
  data.firstVisit ||= now.toISOString();
  data.lastVisit = now.toISOString();
  data.totalVisits ||= 0;
  data.pageViews ||= 0;
  data.totalSeconds ||= 0;
  data.pageCounts ||= {};
  data.clickCounts ||= {};
  data.deviceCounts ||= {};
  data.days ||= {};
  data.recent ||= [];

  if (type === "pageview") {
    data.totalVisits += 1;
    data.pageViews += 1;
    data.pageCounts[page] = (data.pageCounts[page] || 0) + 1;
    data.deviceCounts[getDeviceType()] = (data.deviceCounts[getDeviceType()] || 0) + 1;
    data.days[now.toISOString().slice(0, 10)] = (data.days[now.toISOString().slice(0, 10)] || 0) + 1;
  }

  if (type === "click" || type === "form") {
    data.clickCounts[label] = (data.clickCounts[label] || 0) + 1;
  }

  data.recent.unshift({
    type,
    label: label || page,
    page,
    date: now.toISOString(),
  });
  data.recent = data.recent.slice(0, 12);
  saveAnalytics(data);
};

const currentSession = sessionStorage.getItem(sessionKey);
if (!currentSession) {
  sessionStorage.setItem(sessionKey, String(Date.now()));
}
if (!isAdminPage) {
  track("pageview");
}

const pageStartedAt = Date.now();
window.addEventListener("beforeunload", () => {
  const data = getAnalytics();
  data.totalSeconds = (data.totalSeconds || 0) + Math.max(1, Math.round((Date.now() - pageStartedAt) / 1000));
  saveAnalytics(data);
});

document.addEventListener("click", (event) => {
  if (isAdminPage) return;
  const link = event.target.closest("a, button");
  if (!link) return;
  const label =
    link.getAttribute("aria-label") ||
    link.textContent.trim() ||
    link.getAttribute("href") ||
    "Action";
  track("click", label);
});

const animatedBlocks = document.querySelectorAll(
  ".feature-grid article, .service-panel, .product-card, .timeline article, .mission-grid article, .offer-card"
);

animatedBlocks.forEach((block) => block.classList.add("reveal"));

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

animatedBlocks.forEach((block) => observer.observe(block));

const requestTypeLabels = {
  devis: "Demande de devis",
  analyse: "Analyse de projet IA",
  avis: "Avis client",
};

const params = new URLSearchParams(window.location.search);
const requestedType = requestTypeLabels[(params.get("type") || "").toLowerCase()];

document.querySelectorAll(".mail-form").forEach((form) => {
  const typeField = form.querySelector('[name="request_type"]');
  const requiredFields = form.querySelectorAll(
    '[name="name"], [name="email"], [name="phone"], [name="request_type"], [name="message"]'
  );

  requiredFields.forEach((field) => {
    field.setAttribute("required", "required");
    field.addEventListener("input", () => field.setCustomValidity(""));
    field.addEventListener("change", () => field.setCustomValidity(""));
  });

  if (requestedType && typeField) {
    const matchingOption = Array.from(typeField.options).find(
      (option) => option.value === requestedType
    );
    if (matchingOption) {
      typeField.value = requestedType;
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    requiredFields.forEach((field) => field.setCustomValidity(""));
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const phone = String(data.get("phone") || "").trim();
    const requestType = String(data.get("request_type") || "Demande depuis le site").trim();
    const message = String(data.get("message") || "").trim();

    const fieldValues = [
      ["name", name],
      ["email", email],
      ["phone", phone],
      ["request_type", requestType],
      ["message", message],
    ];
    const missingField = fieldValues.find(([, value]) => !value)?.[0];

    if (missingField) {
      const field = form.querySelector(`[name="${missingField}"]`);
      field?.setCustomValidity("Ce champ est obligatoire.");
      form.reportValidity();
      return;
    }

    const messages = getMessages();
    messages.unshift({
      id: Date.now(),
      name,
      email,
      phone,
      requestType,
      message,
      page: readablePage(location.pathname),
      date: new Date().toISOString(),
      status: "Nouveau",
    });
    saveMessages(messages.slice(0, 100));
    track("form", requestType);

    form.reset();
    if (typeField && requestedType) {
      typeField.value = requestedType;
    }

    const existingNotice = form.querySelector(".form-success");
    existingNotice?.remove();
    const notice = document.createElement("p");
    notice.className = "form-success";
    notice.textContent = "Message envoyé avec succès. ZEMA Technologies vous répondra rapidement.";
    form.appendChild(notice);
  });
});

const formatDate = (value) => {
  if (!value) return "Aucune donnée";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const listFromObject = (object, emptyText) => {
  const entries = Object.entries(object || {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return `<p class="admin-empty">${emptyText}</p>`;
  return entries
    .map(
      ([label, value]) =>
        `<div class="admin-row"><span>${label}</span><strong>${value}</strong></div>`
    )
    .join("");
};

const renderAdmin = () => {
  const root = document.querySelector("[data-admin-dashboard]");
  if (!root) return;
  const data = getAnalytics();
  const messages = getMessages();
  const pageViews = data.pageViews || 0;
  const clicks = Object.values(data.clickCounts || {}).reduce((sum, value) => sum + value, 0);
  const avgTime = pageViews ? Math.round((data.totalSeconds || 0) / pageViews) : 0;

  root.querySelector('[data-stat="totalVisits"]').textContent = data.totalVisits || 0;
  root.querySelector('[data-stat="pageViews"]').textContent = pageViews;
  root.querySelector('[data-stat="messages"]').textContent = messages.length;
  root.querySelector('[data-stat="clicks"]').textContent = clicks;
  root.querySelector('[data-stat="avgTime"]').textContent = avgTime < 60 ? `${avgTime}s` : `${Math.round(avgTime / 60)}min`;

  root.querySelector('[data-admin-list="pages"]').innerHTML = listFromObject(
    data.pageCounts,
    "Aucune page consultée pour le moment."
  );
  root.querySelector('[data-admin-list="clicks"]').innerHTML = listFromObject(
    data.clickCounts,
    "Aucune action suivie pour le moment."
  );
  root.querySelector('[data-admin-list="devices"]').innerHTML = listFromObject(
    data.deviceCounts,
    "Aucun appareil détecté pour le moment."
  );
  root.querySelector('[data-admin-list="recent"]').innerHTML = (data.recent || [])
    .slice(0, 8)
    .map(
      (item) =>
        `<div class="admin-row"><span>${item.label}<small>${item.page} - ${formatDate(item.date)}</small></span><strong>${item.type}</strong></div>`
    )
    .join("") || `<p class="admin-empty">Aucune activité récente.</p>`;

  const messagesContainer = root.querySelector("[data-admin-messages]");
  if (messagesContainer) {
    messagesContainer.innerHTML = messages.length
      ? messages
          .map(
            (item) => `
              <article class="admin-message-card">
                <div class="admin-message-top">
                  <span>${escapeHtml(item.requestType)}</span>
                  <strong>${escapeHtml(item.status || "Nouveau")}</strong>
                </div>
                <h3>${escapeHtml(item.name)}</h3>
                <p class="admin-message-meta">${escapeHtml(item.email)} · ${escapeHtml(item.phone)}</p>
                <p>${escapeHtml(item.message)}</p>
                <small>${escapeHtml(item.page)} · ${formatDate(item.date)}</small>
              </article>
            `
          )
          .join("")
      : `<p class="admin-empty">Aucun message reçu pour le moment.</p>`;
  }

  const topPage = Object.entries(data.pageCounts || {}).sort((a, b) => b[1] - a[1])[0];
  const topAction = Object.entries(data.clickCounts || {}).sort((a, b) => b[1] - a[1])[0];
  const topDevice = Object.entries(data.deviceCounts || {}).sort((a, b) => b[1] - a[1])[0];
  root.querySelector("[data-admin-insights]").innerHTML = [
    `Dernière visite : ${formatDate(data.lastVisit)}`,
    `Page la plus consultée : ${topPage ? `${topPage[0]} (${topPage[1]})` : "pas encore de tendance"}`,
    `Action la plus fréquente : ${topAction ? `${topAction[0]} (${topAction[1]})` : "pas encore de clic suivi"}`,
    `Appareil principal : ${topDevice ? `${topDevice[0]} (${topDevice[1]})` : "pas encore d'appareil dominant"}`,
  ]
    .map((item) => `<p>${item}</p>`)
    .join("");

  root.querySelector("[data-admin-refresh]")?.addEventListener("click", renderAdmin, { once: true });
  root.querySelector("[data-admin-reset]")?.addEventListener("click", () => {
    if (confirm("Réinitialiser les statistiques locales ?")) {
      localStorage.removeItem(analyticsKey);
      localStorage.removeItem(messagesKey);
      location.reload();
    }
  });
};

const setupAdminAccess = () => {
  const login = document.querySelector("[data-admin-login]");
  const dashboard = document.querySelector("[data-admin-dashboard]");
  const form = document.querySelector("[data-admin-login-form]");
  if (!login || !dashboard || !form) return;

  const showDashboard = () => {
    login.classList.add("is-hidden");
    dashboard.classList.remove("is-hidden");
    renderAdmin();
  };

  if (sessionStorage.getItem("zema_admin_auth") === "true") {
    showDashboard();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const username = String(data.get("username") || "").trim();
    const password = String(data.get("password") || "").trim();
    const error = document.querySelector("[data-admin-login-error]");

    if (username === "admin" && password === "admin") {
      sessionStorage.setItem("zema_admin_auth", "true");
      showDashboard();
      return;
    }

    if (error) {
      error.textContent = "Identifiant ou mot de passe incorrect.";
    }
  });

  document.querySelector("[data-admin-logout]")?.addEventListener("click", () => {
    sessionStorage.removeItem("zema_admin_auth");
    location.reload();
  });
};

setupAdminAccess();
