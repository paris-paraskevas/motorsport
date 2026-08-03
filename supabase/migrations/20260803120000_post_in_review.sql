-- Adds 'in_review' between 'draft' and 'approved'.
--
-- Why: `draft` has been doing two jobs. A writer's first save and a finished piece
-- awaiting the operator looked identical, and because the create endpoint notified
-- on every insert, saving half a paragraph pinged the operator. Writers responded
-- by not saving, which is the opposite of what a draft state is for.
--
-- After this: `draft` is the writer's private workspace and notifies nobody;
-- `in_review` is an explicit submission that fires the admin notification;
-- `approved` (with a publish_at) and `published` are unchanged, as is the terminal
-- `rejected`. This mirrors WordPress's "Pending Review" and Ghost's contributor
-- model, both of which separate "can write" from "can publish" the same way.
--
-- The constraint is dropped and recreated because Postgres has no ALTER for a
-- check expression. Verified name before writing this: pg_constraint reports
-- `post_status_check` defined as
--   CHECK (status = ANY (ARRAY['draft','approved','published','rejected']))
-- so no existing row can violate the wider set and the rewrite is additive.
alter table post drop constraint if exists post_status_check;
alter table post
  add constraint post_status_check
  check (status in ('draft', 'in_review', 'approved', 'published', 'rejected'));

-- The admin review queue reads in_review newest-first; post_status_created_idx
-- (status, created_at desc) from the original migration already serves it.
