const CATEGORIES = [
  { id: "all", label: "Все" },
  { id: "conferences", label: "Конференции" },
  { id: "student", label: "Студенческие мероприятия" },
  { id: "wedding", label: "Свадьба" },
  { id: "concerts", label: "Концерты" },
  { id: "phototour", label: "Фототур с Викторией и Сергеем" },
];

const CATEGORY_LABELS = Object.fromEntries(
  CATEGORIES.filter((c) => c.id !== "all").map((c) => [c.id, c.label])
);

const FEED_LAYOUTS = ["featured", "default", "tall", "default", "wide", "compact"];

const state = {
  manifest: [],
  projects: new Map(),
  reviews: null,
  activeCategory: "all",
  openProjectId: null,
  galleryIndex: 0,
  galleryPhotos: [],
  lightboxIndex: 0,
};

const els = {
  categoryFilter: document.getElementById("categoryFilter"),
  feed: document.getElementById("feed"),
  sidebarNav: document.getElementById("sidebarNav"),
  reviewsList: document.getElementById("reviewsList"),
  reviewFormLink: document.getElementById("reviewFormLink"),
  overlay: document.getElementById("projectOverlay"),
  projectTitle: document.getElementById("projectTitle"),
  projectClose: document.getElementById("projectClose"),
  galleryTrack: document.getElementById("galleryTrack"),
  galleryPrev: document.getElementById("galleryPrev"),
  galleryNext: document.getElementById("galleryNext"),
  projectText: document.getElementById("projectText"),
  projectMeta: document.getElementById("projectMeta"),
  projectSidebarList: document.getElementById("projectSidebarList"),
  lightbox: document.getElementById("photoLightbox"),
  lightboxImg: document.getElementById("lightboxImg"),
  lightboxClose: document.getElementById("lightboxClose"),
  lightboxPrev: document.getElementById("lightboxPrev"),
  lightboxNext: document.getElementById("lightboxNext"),
  lightboxCounter: document.getElementById("lightboxCounter"),
  menuToggle: document.getElementById("menuToggle"),
  menuFooterToggle: document.getElementById("menuFooterToggle"),
  sidebarClose: document.getElementById("sidebarClose"),
  mobileBackdrop: document.getElementById("mobileBackdrop"),
};

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}`);
  }
  return response.json();
}

async function loadProject(id) {
  if (state.projects.has(id)) {
    return state.projects.get(id);
  }
  const project = await fetchJson(`data/projects/${id}.json`);
  state.projects.set(id, project);
  return project;
}

function renderFilters() {
  els.categoryFilter.innerHTML = CATEGORIES.map(
    (cat) =>
      `<button type="button" class="filter-btn${
        cat.id === state.activeCategory ? " is-active" : ""
      }" data-category="${cat.id}" role="tab" aria-selected="${
        cat.id === state.activeCategory
      }">${cat.label}</button>`
  ).join("");
}

function getFilteredItems() {
  if (state.activeCategory === "all") {
    return state.manifest;
  }
  return state.manifest.filter((item) => item.category === state.activeCategory);
}

function getFeedLayoutClass(index) {
  if (index === 0) return "feed-item--featured";
  const layout = FEED_LAYOUTS[(index % FEED_LAYOUTS.length) || 1];
  if (layout === "default") return "";
  return `feed-item--${layout}`;
}

function renderFeed() {
  const items = getFilteredItems();

  if (!items.length) {
    els.feed.innerHTML = `<p class="feed-empty">В этой категории пока нет съёмок.</p>`;
    return;
  }

  const html = items
    .map((item, index) => {
      const hasCover = Boolean(item.cover);
      const layoutClass = getFeedLayoutClass(index);
      const isWide = layoutClass === "feed-item--wide";

      const classes = [
        "feed-item",
        layoutClass,
        !hasCover ? "feed-item--text-only" : "",
      ]
        .filter(Boolean)
        .join(" ");

      const imageBlock = hasCover
        ? `<div class="feed-item__image"><img src="${item.cover}" alt="${escapeHtml(item.title)}" loading="lazy"></div>`
        : "";

      const contentBlock = `
        <div class="feed-item__content">
          <h2 class="feed-item__title">${escapeHtml(item.title)}</h2>
          <p class="feed-item__desc">${escapeHtml(item.shortDescription)}</p>
        </div>`;

      const inner = isWide && hasCover
        ? `<div class="feed-item__inner">${imageBlock}${contentBlock}</div>`
        : `${imageBlock}${contentBlock}`;

      return `
        <article class="${classes}" data-id="${item.id}" tabindex="0" role="button">
          ${inner}
        </article>
      `;
    })
    .join("");

  els.feed.innerHTML = `<div class="feed-grid">${html}</div>`;
}

function renderReviews() {
  if (!state.reviews) return;

  els.reviewFormLink.href = state.reviews.formUrl;
  els.reviewsList.innerHTML = state.reviews.items
    .map(
      (review) => `
      <article class="review-card">
        <p class="review-card__author">${escapeHtml(review.author)}</p>
        <p class="review-card__event">${escapeHtml(review.event)}</p>
        <p class="review-card__text">${escapeHtml(review.text)}</p>
      </article>
    `
    )
    .join("");
}

function renderProjectSidebar(activeId) {
  els.projectSidebarList.innerHTML = state.manifest
    .map((item) => {
      const active = item.id === activeId ? " is-active" : "";
      return `
        <button type="button" class="sidebar-event${active}" data-id="${item.id}">
          <span class="sidebar-event__date">${escapeHtml(item.date)}</span>
          <span>
            <span class="sidebar-event__category">${escapeHtml(
              CATEGORY_LABELS[item.category] || item.category
            )}</span>
            <span class="sidebar-event__title">${escapeHtml(item.title)}</span>
          </span>
        </button>
      `;
    })
    .join("");
}

function renderGallery(photos) {
  state.galleryIndex = 0;
  state.galleryPhotos = photos;

  if (!photos.length) {
    els.galleryTrack.innerHTML = `<div class="gallery-slide"><div style="padding:2rem">Нет фотографий</div></div>`;
    updateGalleryNav(photos);
    return;
  }

  els.galleryTrack.innerHTML = photos
    .map(
      (src, index) =>
        `<div class="gallery-slide" data-index="${index}" role="button" tabindex="0" aria-label="Открыть фото ${index + 1}"><img src="${src}" alt="Фото ${index + 1}"></div>`
    )
    .join("");

  bindGalleryImages();
  updateGalleryPosition(photos);
}

function getGalleryMetrics() {
  const wrap = els.galleryTrack?.parentElement;
  const wrapWidth = wrap?.clientWidth || 0;
  const isMobile = window.matchMedia("(max-width: 900px)").matches;
  const slideWidth = isMobile ? wrapWidth : wrapWidth * 0.85;

  return { wrapWidth, slideWidth, isMobile };
}

function syncGalleryHeight() {
  const wrap = els.galleryTrack?.parentElement;
  const slides = els.galleryTrack?.querySelectorAll(".gallery-slide");
  if (!wrap || !slides?.length) return;

  const isMobile = window.matchMedia("(max-width: 900px)").matches;

  if (isMobile) {
    const galleryHeight = Math.round(window.innerHeight * 0.42);
    wrap.style.height = `${galleryHeight}px`;
    slides.forEach((slide) => {
      slide.style.minHeight = `${galleryHeight}px`;
    });
    return;
  }

  const current = slides[state.galleryIndex];
  if (!current) return;

  wrap.style.height = `${current.offsetHeight}px`;
}

function bindGalleryImages() {
  els.galleryTrack.querySelectorAll("img").forEach((img) => {
    if (img.complete) return;
    img.addEventListener(
      "load",
      () => {
        updateGalleryPosition(state.galleryPhotos);
      },
      { once: true }
    );
  });
}

function updateGalleryPosition(photos) {
  const slides = els.galleryTrack.querySelectorAll(".gallery-slide");
  const { wrapWidth, slideWidth, isMobile } = getGalleryMetrics();

  slides.forEach((slide, index) => {
    slide.classList.toggle("is-peek", !isMobile && index === state.galleryIndex + 1);
    slide.style.flex = `0 0 ${slideWidth}px`;
    slide.style.width = `${slideWidth}px`;
    slide.style.minWidth = `${slideWidth}px`;
  });

  if (wrapWidth > 0) {
    els.galleryTrack.style.transform = `translateX(-${state.galleryIndex * slideWidth}px)`;
  } else {
    const slideWidthPercent = getGallerySlideWidthPercent(isMobile);
    els.galleryTrack.style.transform = `translateX(-${state.galleryIndex * slideWidthPercent}%)`;
  }

  updateGalleryNav(photos);
  requestAnimationFrame(syncGalleryHeight);
}

function getGallerySlideWidthPercent(isMobile) {
  return isMobile ? 100 : 85;
}

function updateGalleryNav(photos) {
  const maxIndex = Math.max(0, photos.length - 1);
  els.galleryPrev.disabled = state.galleryIndex <= 0;
  els.galleryNext.disabled = state.galleryIndex >= maxIndex;
}

function resetProjectHeaderScroll() {
  const projectView = document.querySelector(".project-view");
  const projectHeader = document.querySelector(".project-view__header");
  if (projectView) {
    projectView.scrollTop = 0;
  }
  if (projectHeader) {
    projectHeader.style.setProperty("--header-shrink", "0");
  }
}

function initProjectHeaderScroll() {
  const projectView = document.querySelector(".project-view");
  const projectHeader = document.querySelector(".project-view__header");
  if (!projectView || !projectHeader) return;

  const shrinkDistance = 120;
  let ticking = false;

  const updateHeader = () => {
    const progress = Math.min(projectView.scrollTop / shrinkDistance, 1);
    projectHeader.style.setProperty("--header-shrink", progress.toFixed(3));
    ticking = false;
  };

  projectView.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        window.requestAnimationFrame(updateHeader);
        ticking = true;
      }
    },
    { passive: true }
  );

  updateHeader();
}

function openLightbox(index) {
  if (!state.galleryPhotos.length) return;

  state.lightboxIndex = index;
  updateLightbox();
  els.lightbox.hidden = false;
  requestAnimationFrame(() => {
    els.lightbox.classList.add("is-visible");
  });
  document.body.classList.add("overlay-open");
}

function closeLightbox() {
  els.lightbox.classList.remove("is-visible");
  setTimeout(() => {
    els.lightbox.hidden = true;
    if (!state.openProjectId) {
      document.body.classList.remove("overlay-open");
    }
  }, 300);
}

function updateLightbox() {
  const photos = state.galleryPhotos;
  const src = photos[state.lightboxIndex];
  els.lightboxImg.src = src;
  els.lightboxImg.alt = `Фото ${state.lightboxIndex + 1}`;
  els.lightboxCounter.textContent = `${state.lightboxIndex + 1} / ${photos.length}`;
  els.lightboxPrev.disabled = state.lightboxIndex <= 0;
  els.lightboxNext.disabled = state.lightboxIndex >= photos.length - 1;
}

function lightboxStep(delta) {
  const next = state.lightboxIndex + delta;
  if (next < 0 || next >= state.galleryPhotos.length) return;
  state.lightboxIndex = next;
  updateLightbox();
}

async function openProject(id) {
  if (document.body.classList.contains("mobile-nav-open")) {
    closeMobileNav();
  }

  const project = await loadProject(id);
  state.openProjectId = id;

  els.projectTitle.textContent = project.title;
  els.projectText.innerHTML = (project.description || [])
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("");

  els.projectMeta.innerHTML = `
    <span class="project-view__meta-label">Дата</span>
    <p class="project-view__meta-value">${escapeHtml(project.date || "—")}</p>
    <span class="project-view__meta-label">Локация</span>
    <p class="project-view__meta-value">${escapeHtml(project.location || "—")}</p>
    <span class="project-view__meta-label">Категория</span>
    <p class="project-view__meta-value">${escapeHtml(
      CATEGORY_LABELS[project.category] || project.category
    )}</p>
  `;

  renderGallery(project.photos || []);
  renderProjectSidebar(id);

  els.overlay.hidden = false;
  resetProjectHeaderScroll();
  requestAnimationFrame(() => {
    els.overlay.classList.add("is-visible");
    requestAnimationFrame(() => {
      updateGalleryPosition(state.galleryPhotos);
    });
  });
  document.body.classList.add("overlay-open");
  history.pushState({ projectId: id }, "", `#${id}`);
}

function closeProject() {
  state.openProjectId = null;
  resetProjectHeaderScroll();
  els.overlay.classList.remove("is-visible");
  setTimeout(() => {
    els.overlay.hidden = true;
  }, 350);
  document.body.classList.remove("overlay-open");
  history.pushState(null, "", " ");
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setCategory(category) {
  state.activeCategory = category;
  renderFilters();
  renderFeed();
}

function setSidebarPanel(panelId) {
  document.querySelectorAll(".sidebar-nav__item").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.panel === panelId);
  });
  document.querySelectorAll(".sidebar-panel").forEach((panel) => {
    panel.classList.toggle("is-active", panel.id === `panel-${panelId}`);
  });
}

function setFooterMenuState(isOpen) {
  if (!els.menuFooterToggle) return;
  els.menuFooterToggle.textContent = isOpen ? "×" : "≡";
  els.menuFooterToggle.setAttribute("aria-label", isOpen ? "Закрыть меню" : "Открыть меню");
  els.menuFooterToggle.setAttribute("aria-expanded", String(isOpen));
}

function openMobileNav() {
  document.body.classList.add("mobile-nav-open");
  els.mobileBackdrop.hidden = false;
  requestAnimationFrame(() => {
    els.mobileBackdrop.classList.add("is-visible");
  });
  els.menuToggle?.setAttribute("aria-expanded", "true");
  setFooterMenuState(true);
}

function closeMobileNav() {
  document.body.classList.remove("mobile-nav-open");
  els.mobileBackdrop.classList.remove("is-visible");
  els.menuToggle?.setAttribute("aria-expanded", "false");
  setFooterMenuState(false);
  setTimeout(() => {
    if (!document.body.classList.contains("mobile-nav-open")) {
      els.mobileBackdrop.hidden = true;
    }
  }, 350);
}

function bindEvents() {
  els.categoryFilter.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-category]");
    if (!btn) return;
    setCategory(btn.dataset.category);
  });

  els.feed.addEventListener("click", (event) => {
    const item = event.target.closest("[data-id]");
    if (!item) return;
    openProject(item.dataset.id);
  });

  els.feed.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const item = event.target.closest("[data-id]");
    if (!item) return;
    event.preventDefault();
    openProject(item.dataset.id);
  });

  els.sidebarNav.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-panel]");
    if (!btn) return;
    setSidebarPanel(btn.dataset.panel);
  });

  els.menuToggle?.addEventListener("click", openMobileNav);
  els.menuFooterToggle?.addEventListener("click", () => {
    if (document.body.classList.contains("mobile-nav-open")) {
      closeMobileNav();
    } else {
      openMobileNav();
    }
  });
  els.sidebarClose?.addEventListener("click", closeMobileNav);
  els.mobileBackdrop.addEventListener("click", closeMobileNav);

  els.projectClose.addEventListener("click", closeProject);

  els.overlay.addEventListener("click", (event) => {
    if (event.target === els.overlay) {
      closeProject();
    }
  });

  els.projectSidebarList.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-id]");
    if (!btn) return;
    openProject(btn.dataset.id);
  });

  els.galleryPrev.addEventListener("click", async () => {
    if (state.galleryIndex <= 0) return;
    state.galleryIndex -= 1;
    updateGalleryPosition(state.galleryPhotos);
  });

  els.galleryNext.addEventListener("click", async () => {
    if (state.galleryIndex >= state.galleryPhotos.length - 1) return;
    state.galleryIndex += 1;
    updateGalleryPosition(state.galleryPhotos);
  });

  els.galleryTrack.addEventListener("click", (event) => {
    const slide = event.target.closest(".gallery-slide:not(.is-peek)");
    if (!slide) return;
    const index = Number(slide.dataset.index);
    if (!Number.isNaN(index)) {
      openLightbox(index);
    }
  });

  els.galleryTrack.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const slide = event.target.closest(".gallery-slide:not(.is-peek)");
    if (!slide) return;
    event.preventDefault();
    openLightbox(Number(slide.dataset.index));
  });

  els.lightboxClose.addEventListener("click", closeLightbox);

  els.lightbox.addEventListener("click", (event) => {
    if (event.target === els.lightbox) {
      closeLightbox();
    }
  });

  els.lightboxPrev.addEventListener("click", () => lightboxStep(-1));
  els.lightboxNext.addEventListener("click", () => lightboxStep(1));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!els.lightbox.hidden) {
        closeLightbox();
        return;
      }
      if (document.body.classList.contains("mobile-nav-open")) {
        closeMobileNav();
        return;
      }
      if (state.openProjectId) {
        closeProject();
      }
    }

    if (!els.lightbox.hidden) {
      if (event.key === "ArrowLeft") lightboxStep(-1);
      if (event.key === "ArrowRight") lightboxStep(1);
    }
  });

  window.addEventListener("popstate", (event) => {
    if (event.state?.projectId) {
      openProject(event.state.projectId);
    } else if (state.openProjectId) {
      closeProject();
    }
  });

  window.addEventListener("resize", () => {
    if (state.galleryPhotos.length) {
      updateGalleryPosition(state.galleryPhotos);
    }
  });

  initProjectHeaderScroll();
}

async function init() {
  try {
    const [manifest, reviews] = await Promise.all([
      fetchJson("data/manifest.json"),
      fetchJson("data/reviews.json"),
    ]);

    state.manifest = manifest;
    state.reviews = reviews;

    renderFilters();
    renderFeed();
    renderReviews();
    bindEvents();

    const hashId = location.hash.replace("#", "");
    if (hashId) {
      await openProject(hashId);
    }
  } catch (error) {
    els.feed.innerHTML = `<p class="feed-empty">Не удалось загрузить данные. Запустите сайт через локальный сервер (см. README).</p>`;
    console.error(error);
  }
}

init();
