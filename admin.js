const supabaseUrl = "https://bcphfkqddxowdngkwoiq.supabase.co";
const supabaseAnonKey = "sb_publishable_SXREhlNb-q5u3IFNpzWLnw_QBy_9RFW";
const adminEmail = "admin@pulso.dev";
const database = window.supabase?.createClient(supabaseUrl, supabaseAnonKey);
const loginView = document.querySelector("#login-view");
const dashboardView = document.querySelector("#dashboard-view");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const logoutButton = document.querySelector("#logout-button");
const settingsForm = document.querySelector("#settings-form");
const settingsDisclosure = document.querySelector(".settings-disclosure");
const articleForm = document.querySelector("#article-form");
const articleBodyEditor = document.querySelector("#article-body-editor");
const articleList = document.querySelector("#admin-articles");
const articleMessage = document.querySelector("#article-message");
const sponsorForm = document.querySelector("#sponsor-form");
const sponsorDisclosure = document.querySelector(".sponsor-settings-disclosure");
const sponsorMessage = document.querySelector("#sponsor-message");
const settingsMessage = document.querySelector("#settings-message");
const articlesMessage = document.querySelector("#articles-message");
const toast = document.querySelector(".toast");
let articles = [];
let toastTimer;

function setMessage(element, text, type = "") {
  element.textContent = text;
  element.className = `form-message ${type}`.trim();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 3500);
}

function setAuthenticated(isAuthenticated) {
  loginView.hidden = isAuthenticated;
  dashboardView.hidden = !isAuthenticated;
  logoutButton.hidden = !isAuthenticated;
}

function requireDatabase() {
  if (!database) throw new Error("O cliente Supabase não carregou. Confira sua conexão.");
}

async function uploadFile(file) {
  if (!file) return null;
  const safeName = file.name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${crypto.randomUUID()}-${safeName}`;
  const { data, error } = await database.storage.from("news-assets").upload(path, file, {
    cacheControl: "3600",
    upsert: false
  });
  if (error) throw error;
  const { data: publicFile } = database.storage.from("news-assets").getPublicUrl(data.path);
  return publicFile.publicUrl;
}

async function loadSettings() {
  const { data, error } = await database.from("site_settings").select("*").eq("id", 1).single();
  if (error) throw error;
  for (const [name, value] of Object.entries(data)) {
    const input = settingsForm.elements.namedItem(name);
    if (input && input.type !== "file") input.value = value ?? "";
  }
}

async function saveSettings(event) {
  event.preventDefault();
  const submitButton = settingsForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  setMessage(settingsMessage, "Salvando alterações…");
  try {
    const formData = new FormData(settingsForm);
    let imageUrl = String(formData.get("hero_image_url") || "").trim();
    const image = formData.get("hero_image_file");
    if (image instanceof File && image.size) imageUrl = await uploadFile(image);

    const values = {
      id: 1,
      site_name: String(formData.get("site_name")).trim(),
      site_tagline: String(formData.get("site_tagline")).trim(),
      site_note: String(formData.get("site_note")).trim(),
      breaking_text: String(formData.get("breaking_text")).trim(),
      hero_title: String(formData.get("hero_title")).trim(),
      hero_category: String(formData.get("hero_category")).trim(),
      hero_excerpt: String(formData.get("hero_excerpt")).trim(),
      hero_image_url: imageUrl || null,
      accent_color: String(formData.get("accent_color"))
    };
    const { error } = await database.from("site_settings").upsert(values);
    if (error) throw error;
    settingsForm.elements.namedItem("hero_image_url").value = imageUrl;
    settingsForm.elements.namedItem("hero_image_file").value = "";
    setMessage(settingsMessage, "Página inicial atualizada.", "success");
  } catch (error) {
    console.error("Falha ao salvar as configurações do site.", error);
    setMessage(settingsMessage, error.message || "Não foi possível salvar as alterações.", "error");
  } finally {
    submitButton.disabled = false;
  }
}

async function loadSponsorSettings() {
  const { data, error } = await database
    .from("site_settings")
    .select("sponsor_image_url, sponsor_link_url")
    .eq("id", 1)
    .single();
  if (error) throw error;
  sponsorForm.elements.namedItem("sponsor_image_url").value = data.sponsor_image_url ?? "";
  sponsorForm.elements.namedItem("sponsor_link_url").value = data.sponsor_link_url ?? "";
}

async function saveSponsorSettings(event) {
  event.preventDefault();
  const submitButton = sponsorForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  setMessage(sponsorMessage, "Salvando patrocínio…");
  try {
    const formData = new FormData(sponsorForm);
    let imageUrl = String(formData.get("sponsor_image_url") || "").trim() || null;
    const imageFile = formData.get("sponsor_image_file");
    if (imageFile instanceof File && imageFile.size) imageUrl = await uploadFile(imageFile);
    const linkUrl = String(formData.get("sponsor_link_url") || "").trim() || null;
    if (linkUrl) {
      const target = new URL(linkUrl);
      if (!["http:", "https:"].includes(target.protocol)) throw new Error("O link do anúncio precisa começar com http:// ou https://.");
    }

    const { error } = await database.from("site_settings").upsert({
      id: 1,
      sponsor_image_url: imageUrl,
      sponsor_link_url: linkUrl
    });
    if (error) throw error;
    sponsorForm.elements.namedItem("sponsor_image_url").value = imageUrl ?? "";
    sponsorForm.elements.namedItem("sponsor_image_file").value = "";
    setMessage(sponsorMessage, "Patrocínio atualizado.", "success");
  } catch (error) {
    console.error("Falha ao salvar o patrocínio.", error);
    setMessage(sponsorMessage, error.message || "Não foi possível salvar o patrocínio.", "error");
  } finally {
    submitButton.disabled = false;
  }
}

function slugify(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

articleForm.elements.namedItem("title").addEventListener("input", (event) => {
  const slug = articleForm.elements.namedItem("slug");
  const slugInput = articleForm.elements.namedItem("article_slug");
  if (!slug.dataset.edited) {
    slug.value = slugify(event.target.value);
    slugInput.value = slug.value;
  }
});

articleForm.elements.namedItem("article_slug").addEventListener("input", (event) => {
  const slug = articleForm.elements.namedItem("slug");
  slug.value = event.target.value;
  slug.dataset.edited = "true";
});

let editorSelection;
function rememberEditorSelection() {
  const selection = window.getSelection();
  if (selection?.rangeCount && articleBodyEditor.contains(selection.anchorNode)) {
    editorSelection = selection.getRangeAt(0).cloneRange();
  }
}

function restoreEditorSelection() {
  articleBodyEditor.focus();
  if (!editorSelection) return;
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(editorSelection);
}

document.addEventListener("selectionchange", rememberEditorSelection);
articleBodyEditor.addEventListener("keyup", rememberEditorSelection);
articleBodyEditor.addEventListener("mouseup", rememberEditorSelection);
const editorToolbar = document.querySelector(".editor-toolbar");
editorToolbar.addEventListener("mousedown", (event) => {
  if (event.target.closest("button")) event.preventDefault();
});
function applyEditorCommand(control) {
  const { editorCommand: command } = control.dataset;
  restoreEditorSelection();
  document.execCommand("styleWithCSS", false, "false");
  const value = control.matches("select, input") ? control.value : undefined;
  document.execCommand(command, false, value);
  rememberEditorSelection();
}
editorToolbar.addEventListener("click", (event) => {
  const control = event.target.closest("button[data-editor-command]");
  if (control) applyEditorCommand(control);
});
editorToolbar.addEventListener("change", (event) => {
  const control = event.target.closest("select[data-editor-command], input[data-editor-command]");
  if (control) applyEditorCommand(control);
});

async function saveArticle(event) {
  event.preventDefault();
  const submitButton = articleForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  setMessage(articleMessage, "Salvando notícia…");
  try {
    const formData = new FormData(articleForm);
    const id = String(formData.get("id") || "");
    let imageUrl = String(formData.get("image_url") || "").trim() || null;
    let fileUrl = null;
    const imageFile = formData.get("image_file");
    const attachmentFile = formData.get("attachment_file");
    if (imageFile instanceof File && imageFile.size) imageUrl = await uploadFile(imageFile);
    if (attachmentFile instanceof File && attachmentFile.size) fileUrl = await uploadFile(attachmentFile);

    const values = {
      slug: String(formData.get("article_slug") || formData.get("slug")).trim(),
      title: String(formData.get("title")).trim(),
      category: String(formData.get("category") || "Notícias").trim(),
      excerpt: String(formData.get("subtitle") || "").trim().slice(0, 300),
      body: window.PulsoArticleFormat.sanitize(articleBodyEditor.innerHTML),
      image_url: imageUrl,
      is_published: formData.get("is_published") === "on",
      published_at: new Date().toISOString()
    };
    if (fileUrl) {
      values.file_url = fileUrl;
      values.file_name = String(formData.get("file_name") || "").trim() || attachmentFile.name;
    } else if (id) {
      const existing = articles.find((article) => article.id === id);
      values.file_url = existing?.file_url ?? null;
      values.file_name = String(formData.get("file_name") || "").trim() || existing?.file_name || null;
    } else {
      values.file_name = String(formData.get("file_name") || "").trim() || null;
    }

    const request = id
      ? database.from("news_articles").update(values).eq("id", id)
      : database.from("news_articles").insert(values);
    const { error } = await request;
    if (error) throw error;
    resetArticleForm();
    await loadArticles();
    setMessage(articleMessage, "Notícia salva com sucesso.", "success");
  } catch (error) {
    console.error("Falha ao salvar a notícia.", error);
    setMessage(articleMessage, error.message || "Não foi possível salvar a notícia.", "error");
  } finally {
    submitButton.disabled = false;
  }
}

function resetArticleForm() {
  articleForm.reset();
  articleForm.elements.namedItem("id").value = "";
  articleForm.elements.namedItem("slug").dataset.edited = "";
  articleBodyEditor.replaceChildren();
  editorSelection = null;
  document.querySelector(".article-options").open = false;
  document.querySelector("#article-form-title").textContent = "Nova notícia";
}

function renderArticles() {
  articleList.replaceChildren();
  if (!articles.length) {
    setMessage(articlesMessage, "Nenhuma notícia cadastrada ainda.");
    return;
  }
  setMessage(articlesMessage, "");

  for (const article of articles) {
    const row = document.createElement("article");
    row.className = "admin-article";
    if (article.image_url) {
      const image = document.createElement("img");
      image.src = article.image_url;
      image.alt = "";
      image.loading = "lazy";
      row.append(image);
    } else {
      const placeholder = document.createElement("span");
      placeholder.className = "article-placeholder";
      placeholder.textContent = "Sem foto";
      row.append(placeholder);
    }

    const copy = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = article.title;
    const details = document.createElement("p");
    details.className = article.is_published ? "" : "article-status";
    details.textContent = `${article.category} · ${article.is_published ? "Publicado" : "Rascunho"}`;
    copy.append(title, details);

    const actions = document.createElement("div");
    actions.className = "article-actions";
    const editButton = document.createElement("button");
    editButton.className = "admin-button secondary";
    editButton.type = "button";
    editButton.textContent = "Editar";
    editButton.addEventListener("click", () => editArticle(article));
    const deleteButton = document.createElement("button");
    deleteButton.className = "admin-button secondary";
    deleteButton.type = "button";
    deleteButton.textContent = "Excluir";
    deleteButton.addEventListener("click", () => deleteArticle(article));
    actions.append(editButton, deleteButton);
    row.append(copy, actions);
    articleList.append(row);
  }
}

async function loadArticles() {
  setMessage(articlesMessage, "Carregando notícias…");
  const { data, error } = await database
    .from("news_articles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  articles = data;
  renderArticles();
}

function editArticle(article) {
  for (const [name, value] of Object.entries(article)) {
    const input = articleForm.elements.namedItem(name);
    if (!input || input.type === "file") continue;
    if (input.type === "checkbox") input.checked = Boolean(value);
    else input.value = value ?? "";
  }
  articleBodyEditor.innerHTML = window.PulsoArticleFormat.sanitize(article.body);
  articleForm.elements.namedItem("subtitle").value = article.excerpt ?? "";
  articleForm.elements.namedItem("article_slug").value = article.slug;
  document.querySelector(".article-options").open = Boolean(article.file_url || article.file_name);
  articleForm.elements.namedItem("slug").dataset.edited = "true";
  document.querySelector("#article-form-title").textContent = "Editar notícia";
  articleForm.scrollIntoView({ behavior: "smooth", block: "start" });
  setMessage(articleMessage, "");
}

async function deleteArticle(article) {
  if (!window.confirm(`Excluir a notícia “${article.title}”? Esta ação não pode ser desfeita.`)) return;
  const { error } = await database.from("news_articles").delete().eq("id", article.id);
  if (error) {
    console.error("Falha ao excluir notícia.", error);
    showToast(error.message || "Não foi possível excluir a notícia.");
    return;
  }
  if (articleForm.elements.namedItem("id").value === article.id) resetArticleForm();
  await loadArticles();
  showToast("Notícia excluída.");
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!database) {
    setMessage(loginMessage, "O cliente Supabase não carregou. Atualize a página.", "error");
    return;
  }
  const button = loginForm.querySelector('[type="submit"]');
  button.disabled = true;
  setMessage(loginMessage, "Verificando acesso…");
  try {
    const { error } = await database.auth.signInWithPassword({
      email: adminEmail,
      password: document.querySelector("#admin-password").value
    });
    if (error) throw error;
    loginForm.reset();
  } catch (error) {
    console.error("Falha na autenticação do painel.", error);
    setMessage(loginMessage, "Senha inválida ou conta do administrador ainda não configurada.", "error");
  } finally {
    button.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  const { error } = await database.auth.signOut();
  if (error) {
    console.error("Falha ao sair do painel.", error);
    showToast("Não foi possível encerrar a sessão.");
  }
});

settingsForm.addEventListener("submit", saveSettings);
sponsorForm.addEventListener("submit", saveSponsorSettings);
articleForm.addEventListener("submit", saveArticle);
document.querySelector("#new-article-button").addEventListener("click", () => {
  resetArticleForm();
  articleForm.scrollIntoView({ behavior: "smooth", block: "start" });
});
document.querySelector("#homepage-settings-button").addEventListener("click", () => {
  settingsDisclosure.open = true;
  settingsDisclosure.scrollIntoView({ behavior: "smooth", block: "start" });
});
document.querySelector("#sponsor-settings-button").addEventListener("click", () => {
  sponsorDisclosure.open = true;
  sponsorDisclosure.scrollIntoView({ behavior: "smooth", block: "start" });
});
document.querySelector("#refresh-articles").addEventListener("click", () => {
  loadArticles().catch((error) => {
    console.error("Falha ao atualizar as notícias.", error);
    setMessage(articlesMessage, error.message || "Não foi possível carregar as notícias.", "error");
  });
});

if (!database) {
  setMessage(loginMessage, "O cliente Supabase não carregou. Verifique sua conexão.", "error");
} else {
  database.auth.onAuthStateChange((_event, session) => {
    const isAdmin = session?.user?.email === adminEmail;
    setAuthenticated(Boolean(isAdmin));
    if (!isAdmin) return;

    window.setTimeout(() => {
      Promise.all([loadSettings(), loadSponsorSettings(), loadArticles()]).catch((error) => {
        console.error("Falha ao carregar dados do painel.", error);
        showToast(error.message || "Não foi possível carregar o painel.");
      });
    }, 0);
  });
  database.auth.getSession().then(({ data, error }) => {
    if (error) throw error;
    setAuthenticated(data.session?.user?.email === adminEmail);
  }).catch((error) => {
    console.error("Falha ao verificar a sessão do painel.", error);
    setMessage(loginMessage, "Não foi possível verificar a sessão. Atualize a página.", "error");
  });
}
