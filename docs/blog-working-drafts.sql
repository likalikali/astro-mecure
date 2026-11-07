alter table public.blog_documents add column working_source text;
comment on column public.blog_documents.working_source is 'Private working copy for an already published document. Never rendered publicly.';
