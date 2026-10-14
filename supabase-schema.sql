-- Conteúdo editorial e preferências públicas do site.
create table if not exists public.news_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null default '',
  body text not null default '',
  category text not null,
  image_url text,
  file_url text,
  file_name text,
  is_published boolean not null default false,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.news_articles add column if not exists body text not null default '';
alter table public.news_articles add column if not exists file_url text;
alter table public.news_articles add column if not exists file_name text;

create table if not exists public.site_settings (
  id integer primary key check (id = 1),
  site_name text not null default 'PULSO',
  site_tagline text not null default 'JORNALISMO DAQUI',
  site_note text not null default 'A notícia perto de você.',
  breaking_text text not null default 'Confira as principais atualizações e histórias da nossa região',
  hero_title text not null default 'Uma cidade que se transforma começa pelas pessoas',
  hero_category text not null default 'CIDADE',
  hero_excerpt text not null default 'Iniciativas locais mostram como boas ideias podem mudar a rotina de todo mundo.',
  hero_image_url text,
  sponsor_image_url text,
  sponsor_link_url text,
  accent_color text not null default '#f0a52b' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  updated_at timestamptz not null default now()
);

alter table public.site_settings add column if not exists sponsor_image_url text;
alter table public.site_settings add column if not exists sponsor_link_url text;

insert into public.site_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now(),
  constraint newsletter_subscribers_email_format
    check (email = lower(trim(email)) and email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$')
);

alter table public.news_articles enable row level security;
alter table public.site_settings enable row level security;
alter table public.newsletter_subscribers enable row level security;

drop policy if exists "Anyone can read published news" on public.news_articles;
create policy "Anyone can read published news"
  on public.news_articles for select to anon, authenticated
  using (is_published = true);

drop policy if exists "Admin can read all news" on public.news_articles;
create policy "Admin can read all news"
  on public.news_articles for select to authenticated
  using ((select auth.jwt() ->> 'email') = 'admin@pulso.dev');

drop policy if exists "Admin can insert news" on public.news_articles;
create policy "Admin can insert news"
  on public.news_articles for insert to authenticated
  with check ((select auth.jwt() ->> 'email') = 'admin@pulso.dev');

drop policy if exists "Admin can update news" on public.news_articles;
create policy "Admin can update news"
  on public.news_articles for update to authenticated
  using ((select auth.jwt() ->> 'email') = 'admin@pulso.dev')
  with check ((select auth.jwt() ->> 'email') = 'admin@pulso.dev');

drop policy if exists "Admin can delete news" on public.news_articles;
create policy "Admin can delete news"
  on public.news_articles for delete to authenticated
  using ((select auth.jwt() ->> 'email') = 'admin@pulso.dev');

drop policy if exists "Anyone can read site settings" on public.site_settings;
create policy "Anyone can read site settings"
  on public.site_settings for select to anon, authenticated
  using (true);

drop policy if exists "Admin can manage site settings" on public.site_settings;
create policy "Admin can manage site settings"
  on public.site_settings for all to authenticated
  using ((select auth.jwt() ->> 'email') = 'admin@pulso.dev')
  with check ((select auth.jwt() ->> 'email') = 'admin@pulso.dev');

drop policy if exists "Anyone can subscribe to newsletter" on public.newsletter_subscribers;
create policy "Anyone can subscribe to newsletter"
  on public.newsletter_subscribers for insert to anon, authenticated
  with check (true);

grant select on public.news_articles, public.site_settings to anon, authenticated;
grant insert, update, delete on public.news_articles, public.site_settings to authenticated;
revoke all on public.newsletter_subscribers from anon, authenticated;
grant insert on public.newsletter_subscribers to anon, authenticated;

-- O painel usa o usuário admin@pulso.dev. Crie essa conta em
-- Supabase > Authentication > Users antes de entrar no painel.
-- A senha nunca é armazenada pelo site: a autenticação é feita pelo Supabase Auth.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'news-assets',
  'news-assets',
  true,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can read news assets" on storage.objects;
create policy "Anyone can read news assets"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'news-assets');

drop policy if exists "Admin can upload news assets" on storage.objects;
create policy "Admin can upload news assets"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'news-assets'
    and (select auth.jwt() ->> 'email') = 'admin@pulso.dev'
  );

drop policy if exists "Admin can update news assets" on storage.objects;
create policy "Admin can update news assets"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'news-assets'
    and (select auth.jwt() ->> 'email') = 'admin@pulso.dev'
  )
  with check (
    bucket_id = 'news-assets'
    and (select auth.jwt() ->> 'email') = 'admin@pulso.dev'
  );

drop policy if exists "Admin can delete news assets" on storage.objects;
create policy "Admin can delete news assets"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'news-assets'
    and (select auth.jwt() ->> 'email') = 'admin@pulso.dev'
  );
