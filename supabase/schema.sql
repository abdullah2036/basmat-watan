-- ============================================================
--  بصمة وطن — قاعدة البيانات
--  الصقي هذا الملف كاملًا في: Supabase → SQL Editor → Run
--  كل المشاركات تظهر مباشرة — لا مراجعة ولا انتظار.
-- ============================================================

-- ---------- ١) البصمات ----------
create table if not exists public.prints (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 20),
  x           real not null check (x >= 0 and x <= 1000),
  y           real not null check (y >= 0 and y <= 800),
  color       text not null default '#2E7D52' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at  timestamptz not null default now()
);

create index if not exists prints_created_idx on public.prints (created_at);

alter table public.prints enable row level security;

drop policy if exists "prints_read"   on public.prints;
create policy "prints_read"   on public.prints for select to anon, authenticated using (true);

drop policy if exists "prints_insert" on public.prints;
create policy "prints_insert" on public.prints for insert to anon, authenticated with check (true);


-- ---------- ٢) المشاركات ----------
do $$ begin
  create type entry_kind as enum ('vision','text','audio','photo');
exception when duplicate_object then null; end $$;

create table if not exists public.entries (
  id          uuid primary key default gen_random_uuid(),
  kind        entry_kind not null,
  name        text not null check (char_length(name) between 1 and 40),
  rel         text,
  "text"      text check (char_length("text") <= 280),
  media_url   text,
  created_at  timestamptz not null default now()
);

create index if not exists entries_created_idx on public.entries (created_at desc);

alter table public.entries enable row level security;

drop policy if exists "entries_read"   on public.entries;
create policy "entries_read"   on public.entries for select to anon, authenticated using (true);

drop policy if exists "entries_insert" on public.entries;
create policy "entries_insert" on public.entries for insert to anon, authenticated with check (true);


-- ---------- ٣) تخزين الصور والأصوات ----------
insert into storage.buckets (id, name, public)
values ('musharakat', 'musharakat', true)
on conflict (id) do nothing;

drop policy if exists "media_upload" on storage.objects;
create policy "media_upload" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'musharakat');

drop policy if exists "media_read" on storage.objects;
create policy "media_read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'musharakat');


-- ============================================================
--  إدارة سريعة من Supabase (لا تحتاج لوحة داخل الموقع)
-- ============================================================
--
-- حذف مشاركة واحدة غير مناسبة:
--   Table Editor → entries → حددي الصف → Delete
--   أو:  delete from public.entries where id = 'ضعي-المعرّف-هنا';
--
-- حذف بصمة:
--   delete from public.prints where id = 'ضعي-المعرّف-هنا';
--
-- مسح بيانات التجربة قبل إرسال الرابط للأهالي:
--   truncate public.prints;
--   truncate public.entries;
--
-- تصدير كل المشاركات بعد المناسبة:
--   Table Editor → entries → Export to CSV
