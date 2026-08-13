ALTER TABLE public.registries
  ADD COLUMN IF NOT EXISTS reserved_display TEXT NOT NULL DEFAULT 'SHOW';

ALTER TABLE public.registries
  DROP CONSTRAINT IF EXISTS registries_reserved_display_check;
ALTER TABLE public.registries
  ADD CONSTRAINT registries_reserved_display_check CHECK (reserved_display IN ('SHOW','HIDE'));

INSERT INTO public.registries (
  id, owner_id, slug, title, baby_name, welcome_message, description,
  type, visibility, is_public, allow_indexing, surprise_mode, is_demo,
  theme, hero_style, font_pair, layout, show_progress, reserved_display, status, due_date
) VALUES (
  '11111111-1111-4111-8111-111111111111',
  '24638351-cb4e-4d71-bd30-adfa32c7a2d7',
  'demo-mila',
  'Liste de naissance de Mila',
  'Mila',
  'Bienvenue sur cette liste de démonstration ! Elle vous montre exactement ce que verront vos proches : des cadeaux de plusieurs boutiques, réservables en un clic.',
  'Exemple de liste de naissance Mila avec des cadeaux de plusieurs magasins.',
  'BIRTH', 'PUBLIC', true, false, false, true,
  'blush', 'soft', 'baloo', 'grid', true, 'SHOW', 'ACTIVE', '2026-11-15'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.items (registry_id, title, description, store_name, price, currency, quantity, reserved_qty, status, kind, position, url)
SELECT '11111111-1111-4111-8111-111111111111', v.title, v.description, v.store, v.price, 'EUR', 1, v.reserved,
       v.status::public.item_status, v.kind::public.item_kind, v.pos, v.url
FROM (VALUES
  ('Poussette compacte Cybex', 'Légère, pliable d''une main, parfaite pour la ville.', 'Amazon', 499.00, 0, 'AVAILABLE', 'LINK', 1, 'https://www.amazon.fr/'),
  ('Lit bébé évolutif en hêtre', 'Se transforme en lit enfant, à monter en 30 minutes.', 'IKEA', 149.00, 0, 'AVAILABLE', 'LINK', 2, 'https://www.ikea.com/fr/fr/'),
  ('Doudou lapin en coton bio', 'Cousu à la main par une petite boutique française.', 'Petite boutique', 24.90, 0, 'AVAILABLE', 'MANUAL', 3, NULL),
  ('Transat bébé', 'Pour les siestes du salon.', 'Vertbaudet', 89.00, 1, 'RESERVED', 'LINK', 4, 'https://www.vertbaudet.fr/'),
  ('Lot de 5 bodys naissance', 'Coton doux, taille naissance.', 'H&M', 19.99, 0, 'AVAILABLE', 'MANUAL', 5, NULL),
  ('Veilleuse musicale', 'Lumière douce et berceuses.', 'Amazon', 29.90, 1, 'RESERVED', 'LINK', 6, 'https://www.amazon.fr/'),
  ('Tapis d''éveil', 'Beaucoup de textures à explorer.', 'Amazon', 45.00, 0, 'AVAILABLE', 'LINK', 7, 'https://www.amazon.fr/'),
  ('Chaise haute évolutive', 'Pour accompagner les premiers repas.', 'IKEA', 89.00, 0, 'AVAILABLE', 'LINK', 8, 'https://www.ikea.com/fr/fr/')
) AS v(title, description, store, price, reserved, status, kind, pos, url)
WHERE NOT EXISTS (
  SELECT 1 FROM public.items WHERE registry_id = '11111111-1111-4111-8111-111111111111'
);
