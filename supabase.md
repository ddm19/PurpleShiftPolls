# Supabase Setup — Purple Shift

This app uses Supabase for the database and for storing uploaded level
images. Follow these steps to wire your own project.

## 1. Create a project

1. Go to <https://supabase.com> → **New project**.
2. Once it's ready, open **Project Settings → API** and copy:
   - **Project URL**
   - **`anon` / publishable key**
   - **`service_role` key** (server-only, never commit)

## 2. Configure environment variables

Add these to `.env` (already scaffolded in the repo):

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key

# Server-side equivalents (for future server functions)
SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

The browser client lives in `src/lib/supabase.ts`. Restart `vite dev` after
editing `.env` so the new values are picked up.

## 3. Database schema

Run the following SQL in **Supabase → SQL editor → New query**. It creates
the three tables the app needs, plus permissive RLS policies suitable for an
anonymous public survey + an admin UI gated only by the hardcoded `7777`
password on the frontend.

```sql
-- ============================================================
-- Purple Shift — schema
-- ============================================================

-- ---------- questions ----------
create table if not exists public.questions (
    id              uuid primary key default gen_random_uuid(),
    type            text not null check (type in ('text', 'multiple_choice', 'level_gallery')),
    text_prompt_es  text not null default '',
    text_prompt_en  text not null default '',
    "order"         integer not null default 1,
    choices         jsonb,
    created_at      timestamptz not null default now()
);

create index if not exists questions_order_idx on public.questions ("order");

-- ---------- level_options ----------
create table if not exists public.level_options (
    id           uuid primary key default gen_random_uuid(),
    question_id  uuid not null references public.questions(id) on delete cascade,
    title        text not null default '',
    image_url    text not null,
    image_path   text,
    created_at   timestamptz not null default now()
);

create index if not exists level_options_question_id_idx
    on public.level_options (question_id);

-- ---------- responses ----------
create table if not exists public.responses (
    id           uuid primary key default gen_random_uuid(),
    question_id  uuid not null references public.questions(id) on delete cascade,
    answer       text not null,
    created_at   timestamptz not null default now()
);

create index if not exists responses_question_id_idx
    on public.responses (question_id);

-- ============================================================
-- Data API grants (required — Supabase no longer grants by default)
-- ============================================================
grant select, insert, update, delete on public.questions     to anon, authenticated;
grant select, insert, update, delete on public.level_options to anon, authenticated;
grant select, insert                  on public.responses    to anon, authenticated;
grant all on public.questions     to service_role;
grant all on public.level_options to service_role;
grant all on public.responses     to service_role;

-- ============================================================
-- Row-Level Security
-- ============================================================
alter table public.questions     enable row level security;
alter table public.level_options enable row level security;
alter table public.responses     enable row level security;

-- Questions: public read; public write (admin UI is password-gated client-side).
-- Tighten these later if you add real auth.
create policy "questions_select_all"  on public.questions     for select using (true);
create policy "questions_write_all"   on public.questions     for all    using (true) with check (true);

create policy "options_select_all"    on public.level_options for select using (true);
create policy "options_write_all"     on public.level_options for all    using (true) with check (true);

-- Responses: anyone can submit; nobody can read back from the client
-- (use the service role in the Supabase dashboard to view them).
create policy "responses_insert_all"  on public.responses     for insert with check (true);
```

> **Security note.** The admin password (`7777`) is enforced only in the
> browser. The RLS policies above allow any visitor to mutate
> `questions`/`level_options`. Replace these with auth-scoped policies before
> shipping publicly — e.g. require a Supabase auth user with an `admin` role.

## 4. Storage bucket for level images

The level-gallery uploader writes to a Storage bucket named **`level-images`**.

### a) Create the bucket

Supabase → **Storage → New bucket**
- Name: `level-images`
- Public bucket: **enabled** (so `getPublicUrl` returns a directly viewable URL)

Or via SQL:

```sql
insert into storage.buckets (id, name, public)
values ('level-images', 'level-images', true)
on conflict (id) do nothing;
```

### b) Storage policies

The frontend uses the anon key for both reads and writes, so we need policies
on `storage.objects` scoped to this bucket.

```sql
-- Public read (bucket is also marked public, but the policy is required for the API)
create policy "level_images_public_read"
    on storage.objects for select
    using (bucket_id = 'level-images');

-- Anonymous upload / update / delete (admin UI uses the anon key)
create policy "level_images_anon_insert"
    on storage.objects for insert
    with check (bucket_id = 'level-images');

create policy "level_images_anon_update"
    on storage.objects for update
    using (bucket_id = 'level-images')
    with check (bucket_id = 'level-images');

create policy "level_images_anon_delete"
    on storage.objects for delete
    using (bucket_id = 'level-images');
```

Same caveat as the table policies — tighten once real auth is in place.

## 5. Optional seed data

Insert a few starter questions so the survey isn't empty on first load:

```sql
insert into public.questions (type, text_prompt_es, text_prompt_en, "order", choices) values
    ('text',            '¿Cuál es tu nombre en clave, operador?', 'What''s your callsign, operator?', 1, null),
    ('multiple_choice', '¿Estilo de combate preferido en Purple Shift?', 'Preferred combat style in Purple Shift?', 2,
        '["Stealth Infiltrator","Heavy Gunner","Tech Hacker","Blade Runner"]'::jsonb),
    ('level_gallery',   '¿Qué nivel deberíamos lanzar primero?', 'Which level should we ship first?', 3, null);
```

## 6. Migrating an existing database (single-language → bilingual prompts)

If you already have a `questions` table with the old single `text_prompt`
column, run this once in the SQL editor to split it into
`text_prompt_es` / `text_prompt_en` without losing data (existing prompts are
assumed to be Spanish, matching the original UI language):

```sql
alter table public.questions add column if not exists text_prompt_es text not null default '';
alter table public.questions add column if not exists text_prompt_en text not null default '';

update public.questions set text_prompt_es = text_prompt where text_prompt_es = '';

alter table public.questions drop column if exists text_prompt;
```

After running this, go to `/admin` and fill in the English (`Question
(English)`) field for each question — it stays empty until you translate it,
and the survey falls back to the Spanish prompt for any question missing an
English one.

## 7. Verify

1. Restart the dev server.
2. Open `/admin`, enter password `7777`, and create or edit a question.
3. For a `level_gallery` question, drag images into the dropzone, give them
   titles, and click **Save**. Images land in the `level-images` bucket and
   rows appear in `public.level_options`.
4. Visit `/` and complete the survey. New rows show up in `public.responses`.
