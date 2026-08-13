ALTER TABLE public.registries
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'blush',
  ADD COLUMN IF NOT EXISTS accent_color text,
  ADD COLUMN IF NOT EXISTS hero_style text NOT NULL DEFAULT 'soft',
  ADD COLUMN IF NOT EXISTS font_pair text NOT NULL DEFAULT 'baloo',
  ADD COLUMN IF NOT EXISTS layout text NOT NULL DEFAULT 'grid',
  ADD COLUMN IF NOT EXISTS show_progress boolean NOT NULL DEFAULT true;

ALTER TABLE public.registries
  ADD CONSTRAINT registries_theme_check CHECK (theme IN ('blush','sauge','terracotta','nuit','or','ciel')),
  ADD CONSTRAINT registries_hero_style_check CHECK (hero_style IN ('soft','cover','minimal')),
  ADD CONSTRAINT registries_font_pair_check CHECK (font_pair IN ('baloo','serif','moderne')),
  ADD CONSTRAINT registries_layout_check CHECK (layout IN ('grid','list','magazine')),
  ADD CONSTRAINT registries_accent_color_check CHECK (accent_color IS NULL OR accent_color ~ '^#[0-9a-fA-F]{6}$');