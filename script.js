const menuToggle = document.querySelector(".menu-toggle");
const primaryNav = document.querySelector(".primary-nav");
const searchToggle = document.querySelector(".search-toggle");
const searchPanel = document.querySelector(".search-panel");
const toast = document.querySelector(".toast");
const newsGrid = document.querySelector(".news-grid");
const dataStatus = document.querySelector(".data-status");
const supabaseUrl = "https://bcphfkqddxowdngkwoiq.supabase.co";
const supabaseAnonKey = "sb_publishable_SXREhlNb-q5u3IFNpzWLnw_QBy_9RFW";
const database = window.supabase?.createClient(supabaseUrl, supabaseAnonKey);
let toastTimer;

document.querySelector("[data-current-date]").textContent = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric"
}).format(new Date());

fetch("version.json")
  .then((response) => {
    if (!response.ok) throw new Error(`Não foi possível carregar a versão do site (${response.status}).`);
    return response.json();
  })
  .then((version) => {
    document.querySelector("[data-site-version]").textContent = version.version ? `· ${version.version}` : "";
  })
  .catch((error) => console.error("Não foi possível carregar a versão do site.", error));

menuToggle.addEventListener("click", () => {
  const isOpen = primaryNav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
});

searchToggle.addEventListener("click", () => {
  const isOpen = searchPanel.classList.toggle("open");
  searchToggle.setAttribute("aria-expanded", String(isOpen));
  if (isOpen) document.querySelector("#site-search").focus();
});

function showMessage(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 3500);
}

document.querySelector(".search-panel").addEventListener("submit", (event) => {
  event.preventDefault();
  const query = document.querySelector("#site-search").value.trim();
  loadArticles(query);
});

document.querySelector(".newsletter-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.querySelector("#email");
  if (!email.reportValidity()) return;
  if (!database) {
    showMessage("Não foi possível conectar ao banco. Tente novamente mais tarde.");
    return;
  }

  let error;
  try {
    ({ error } = await database
      .from("newsletter_subscribers")
      .insert({ email: email.value.trim().toLowerCase() }));
  } catch (requestError) {
    console.error("Falha de rede ao cadastrar o e-mail na newsletter.", requestError);
    showMessage("Não foi possível conectar ao banco. Tente novamente.");
    return;
  }

  if (error) {
    console.error("Não foi possível cadastrar o e-mail na newsletter.", error);
    showMessage(error.code === "23505"
      ? "Este e-mail já está cadastrado."
      : "Não foi possível concluir o cadastro. Tente novamente.");
    return;
  }

  showMessage("Obrigado! Seu cadastro foi recebido.");
  email.value = "";
});

document.querySelectorAll(".nav-inner a").forEach((link) => {
  link.addEventListener("click", () => {
    primaryNav.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  });
});

function formatPublishedDate(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function createArticleCard(article) {
  const card = document.createElement("article");
  card.className = article.image_url ? "news-card" : "news-card news-card--text-only";

  if (article.image_url) {
    const imageLink = document.createElement("a");
    imageLink.className = "card-image";
    imageLink.href = article.slug ? `noticia.html?slug=${encodeURIComponent(article.slug)}` : "#destaque";
    const image = document.createElement("img");
    image.src = article.image_url;
    image.alt = "";
    image.loading = "lazy";
    imageLink.append(image);

    const category = document.createElement("span");
    category.textContent = article.category;
    imageLink.append(category);
    card.append(imageLink);
  }

  const copy = document.createElement("div");
  copy.className = article.image_url ? "card-copy" : "card-copy card-copy--text-only";
  if (!article.image_url) {
    const category = document.createElement("span");
    category.className = "news-category";
    category.textContent = article.category;
    copy.append(category);
  }
  const date = document.createElement("time");
  date.dateTime = article.published_at;
  date.textContent = formatPublishedDate(article.published_at);

  const heading = document.createElement("h3");
  const titleLink = document.createElement("a");
  titleLink.href = article.slug ? `noticia.html?slug=${encodeURIComponent(article.slug)}` : "#destaque";
  titleLink.textContent = article.title;
  heading.append(titleLink);

  if (article.excerpt && article.body?.trim()) {
    const subtitle = document.createElement("p");
    subtitle.className = "news-subtitle";
    subtitle.textContent = article.excerpt;
    copy.append(subtitle);
  }

  const body = document.createElement("div");
  body.className = "news-body";
  body.innerHTML = window.PulsoArticleFormat.sanitize(article.body?.trim() || article.excerpt);
  copy.append(body);
  copy.prepend(date, heading);
  card.append(copy);
  return card;
}

async function loadArticles(searchTerm = "") {
  if (!database) {
    dataStatus.textContent = "Não foi possível iniciar o cliente Supabase. Verifique sua conexão.";
    console.error("O cliente Supabase não foi carregado.");
    return;
  }

  dataStatus.textContent = searchTerm ? "Buscando notícias…" : "Carregando notícias…";
  newsGrid.replaceChildren();

  const articleQuery = (column) => {
    let query = database
      .from("news_articles")
      .select("title, excerpt, body, category, image_url, slug, published_at")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(6);

    if (searchTerm) query = query.ilike(column, `%${searchTerm}%`);
    return query;
  };

  let data;
  let error;
  try {
    ({ data, error } = await articleQuery("title"));
    if (!error && searchTerm && !data.length) {
      ({ data, error } = await articleQuery("excerpt"));
    }
  } catch (requestError) {
    console.error("Falha de rede ao carregar notícias do Supabase.", requestError);
    dataStatus.textContent = "Não foi possível conectar ao banco. Verifique sua conexão.";
    return;
  }

  if (error) {
    console.error("Não foi possível carregar as notícias do Supabase.", error);
    dataStatus.textContent = "Não foi possível carregar as notícias. Verifique a conexão com o banco.";
    return;
  }

  if (!data.length) {
    dataStatus.textContent = searchTerm
      ? "Nenhuma notícia encontrada para essa busca."
      : "Ainda não há notícias publicadas.";
    return;
  }

  newsGrid.replaceChildren(...data.map(createArticleCard));
  dataStatus.textContent = searchTerm ? `${data.length} notícia(s) encontrada(s).` : "";
}

async function loadSiteSettings() {
  if (!database) return;
  const { data, error } = await database.from("site_settings").select("*").eq("id", 1).maybeSingle();
  if (error) {
    console.error("Não foi possível carregar as configurações do site.", error);
    return;
  }
  if (!data) return;

  for (const [key, selector] of Object.entries({
    site_name: "[data-site-name]",
    site_tagline: "[data-site-tagline]",
    site_note: "[data-site-note]",
    breaking_text: "[data-breaking-text]",
    hero_title: "[data-hero-title]",
    hero_category: "[data-hero-category]",
    hero_excerpt: "[data-hero-excerpt]"
  })) {
    if (!data[key]) continue;
    document.querySelectorAll(selector).forEach((element) => {
      element.textContent = data[key];
    });
  }
  if (data.hero_image_url) document.querySelector("[data-hero-image]").src = data.hero_image_url;
  if (/^#[0-9a-f]{6}$/i.test(data.accent_color)) {
    document.documentElement.style.setProperty("--accent", data.accent_color);
  }
}

Promise.all([loadArticles(), loadSiteSettings()]).catch((error) => {
  console.error("Não foi possível carregar todo o conteúdo do site.", error);
});
