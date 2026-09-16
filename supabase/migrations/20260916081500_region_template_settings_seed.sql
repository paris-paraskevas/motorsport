-- Component Settings for the region templates, the five looks (the components
-- programme, P1.1; APEX: a theme's component defaults): the template a region
-- of each kind starts with when it is placed on a page. Four more rows of
-- `setting`, in the shape of 20260909050000, read by the Page Designer when it
-- creates a region (lib/design/setting-defaults.ts holds the same shipped
-- values as the fallback); a region carries its own template from then on, so
-- a changed default changes no existing page. Seeded only when the key is
-- absent, so re-applying never overwrites an edit.
begin;

insert into setting (application_key, key, value, type, description) values
  ('paddock', 'region.static.template', 'standard', 'text', 'The template, the look, a Static Content region placed on a page starts with: Plain, Boxed, Band, Aside or Hero. Each region can still be changed on its page.'),
  ('paddock', 'region.image.template',  'standard', 'text', 'The template, the look, an Image region placed on a page starts with: Plain, Boxed, Band, Aside or Hero. Each region can still be changed on its page.'),
  ('paddock', 'region.list.template',   'standard', 'text', 'The template, the look, a List region placed on a page starts with: Plain, Boxed, Band, Aside or Hero. Each region can still be changed on its page.'),
  ('paddock', 'region.button.template', 'standard', 'text', 'The template, the look, a Button region placed on a page starts with: Plain, Boxed, Band, Aside or Hero. Each region can still be changed on its page.')
on conflict (application_key, key) do nothing;

commit;
