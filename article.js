const database = window.supabase?.createClient(
  "https://bcphfkqddxowdngkwoiq.supabase.co",
  "sb_publishable_SXREhlNb-q5u3IFNpzWLnw_QBy_9RFW"
);
const status = document.querySelector(".article-status");
const content = document.querySelector(".article-layout");

function renderSponsor(imageUrl, linkUrl) {
  if (!imageUrl) return;
  const sidebar = document.querySelector("[data-sponsor-sidebar]");
  const link = document.querySelector("[data-sponsor-link]");
  const image = document.querySelector("[data-sponsor-image]");
  content.classList.add("has-sponsor");
  image.src = imageUrl;
  image.alt = "Patrocinador";
  if (linkUrl) {
    try {
      const target = new URL(linkUrl);
      if (!["http:", "https:"].includes(target.protocol)) throw new Error("URL do patrocinador inválida.");
      link.href = target.href;
    } catch (error) {
      console.error("O link do patrocinador não é válido.", error);
      link.removeAttribute("href");
      link.removeAttribute("target");
      link.removeAttribute("rel");
    }
  } else {
    link.removeAttribute("href");
    link.removeAttribute("target");
    link.removeAttribute("rel");
  }
  sidebar.hidden = false;
}

async function loadArticle() {
  if (!database) {
    status.textContent = "Não foi possível iniciar a conexão com as notícias.";
    return;
  }
  const slug = new URLSearchParams(window.location.search).get("slug");
  if (!slug) {
    status.textContent = "Notícia não encontrada.";
    return;
  }

  const { data, error } = await database
    .from("news_articles")
    .select("title, excerpt, category, image_url, body, file_url, file_name, published_at")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error) {
    console.error("Não foi possível carregar a notícia.", error);
    status.textContent = "Ocorreu um erro ao carregar a notícia.";
    return;
  }
  if (!data) {
    status.textContent = "Notícia não encontrada ou ainda não publicada.";
    return;
  }

  document.title = `${data.title} — Pulso`;
  document.querySelector("[data-article-title]").textContent = data.title;
  document.querySelector("[data-article-excerpt]").textContent = data.excerpt;
  document.querySelector("[data-article-author]").textContent = "Pulso";
  const date = document.querySelector("[data-article-date]");
  date.dateTime = data.published_at;
  date.textContent = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" }).format(new Date(data.published_at));

  const image = document.querySelector("[data-article-image]");
  if (data.image_url) {
    image.src = data.image_url;
    image.alt = data.title;
    image.hidden = false;
  }
  const body = document.querySelector("[data-article-body]");
  body.innerHTML = window.PulsoArticleFormat.sanitize(data.body);
  const attachment = document.querySelector("[data-article-file]");
  if (data.file_url) {
    attachment.href = data.file_url;
    attachment.download = data.file_name || "";
    attachment.textContent = data.file_name || "Baixar arquivo";
    attachment.hidden = false;
  }
  const { data: sponsor, error: sponsorError } = await database
    .from("site_settings")
    .select("sponsor_image_url, sponsor_link_url")
    .eq("id", 1)
    .maybeSingle();
  if (sponsorError) {
    console.error("Não foi possível carregar o patrocínio da página.", sponsorError);
  } else if (sponsor) {
    renderSponsor(sponsor.sponsor_image_url, sponsor.sponsor_link_url);
  }
  status.hidden = true;
  content.hidden = false;
}

loadArticle().catch((error) => {
  console.error("Falha inesperada ao carregar notícia.", error);
  status.textContent = "Ocorreu um erro ao carregar a notícia.";
});
