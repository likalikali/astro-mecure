create table public.blog_documents (
 path text primary key,
 kind text not null check (kind in ('post','page')),
 slug text not null,
 source text not null,
 meta jsonb not null,
 html text not null default '',
 headings jsonb not null default '[]',
 excerpt text not null default '',
 word_count integer not null default 0,
 version uuid not null default gen_random_uuid(),
 deleted boolean not null default false,
 saved_at timestamptz not null default now(),
 unique(kind,slug)
);
create table public.blog_document_versions (
 id bigint generated always as identity primary key,
 path text not null,
 version uuid not null,
 snapshot jsonb not null,
 recorded_at timestamptz not null default now()
);
create index blog_document_versions_path_time on public.blog_document_versions(path,recorded_at desc);
alter table public.blog_documents enable row level security;
alter table public.blog_document_versions enable row level security;
revoke all on public.blog_documents, public.blog_document_versions from anon,authenticated;
grant all on public.blog_documents, public.blog_document_versions to service_role;
grant usage,select on sequence public.blog_document_versions_id_seq to service_role;
create function public.record_blog_version() returns trigger language plpgsql security invoker set search_path = pg_catalog as $$
begin
 insert into public.blog_document_versions(path,version,snapshot) values(new.path,new.version,to_jsonb(new));
 return new;
end $$;
revoke all on function public.record_blog_version() from public,anon,authenticated;
grant execute on function public.record_blog_version() to service_role;
create trigger blog_document_history after insert or update on public.blog_documents for each row execute function public.record_blog_version();
