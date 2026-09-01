-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ENUMS
CREATE TYPE public.platform_role AS ENUM ('USER', 'PLATFORM_ADMIN', 'SUPER_ADMIN');
CREATE TYPE public.account_status AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED');
CREATE TYPE public.dm_permission AS ENUM ('EVERYONE', 'FRIENDS', 'NONE');
CREATE TYPE public.media_owner_type AS ENUM ('USER_AVATAR', 'TEAM_LOGO', 'EVENT_BANNER', 'EVENT_LOGO', 'MATCH_PHOTO', 'MATCH_VIDEO', 'CERTIFICATE', 'MESSAGE_ATTACHMENT');
CREATE TYPE public.media_resource_type AS ENUM ('image', 'video', 'raw');

-- set_updated_at function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- media_assets (created first so users.avatar_media_id can reference it)
CREATE TABLE public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type public.media_owner_type NOT NULL,
  owner_id uuid NOT NULL,
  cloudinary_public_id text UNIQUE NOT NULL,
  secure_url text NOT NULL,
  resource_type public.media_resource_type NOT NULL,
  width int,
  height int,
  format text,
  bytes int,
  uploaded_by uuid NOT NULL,
  tags text[],
  created_at timestamptz NOT NULL DEFAULT NOW()
);

-- users
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  unique_code text UNIQUE,
  username text UNIQUE,
  display_name text,
  avatar_media_id uuid REFERENCES public.media_assets(id) ON DELETE SET NULL,
  date_of_birth date,
  gender text,
  phone text UNIQUE,
  email text UNIQUE NOT NULL,
  preferred_position text,
  strong_foot text,
  bio text,
  location_text text,
  platform_role public.platform_role NOT NULL DEFAULT 'USER',
  account_status public.account_status NOT NULL DEFAULT 'ACTIVE',
  email_verified boolean NOT NULL DEFAULT false,
  phone_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- user_privacy_settings
CREATE TABLE public.user_privacy_settings (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  profile_public boolean NOT NULL DEFAULT true,
  stats_public boolean NOT NULL DEFAULT true,
  friends_visible boolean NOT NULL DEFAULT true,
  teams_visible boolean NOT NULL DEFAULT true,
  match_history_public boolean NOT NULL DEFAULT true,
  dm_permission public.dm_permission NOT NULL DEFAULT 'EVERYONE',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_user_privacy_settings_updated_at
BEFORE UPDATE ON public.user_privacy_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- RLS for media_assets
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "media_assets_select"
  ON public.media_assets FOR SELECT
  USING (true);

-- Only allow insert if the user is inserting their own avatar
CREATE POLICY "media_assets_insert_avatar"
  ON public.media_assets FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid() AND
    owner_type = 'USER_AVATAR' AND
    owner_id = auth.uid()
  );

-- No update or delete allowed for client directly (fastapi handles destroy)
REVOKE UPDATE, DELETE ON public.media_assets FROM authenticated, anon;


-- RLS for users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select"
  ON public.users FOR SELECT
  USING (true);

CREATE POLICY "users_update"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- RLS for user_privacy_settings
ALTER TABLE public.user_privacy_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_privacy_settings_select"
  ON public.user_privacy_settings FOR SELECT
  USING (true);

CREATE POLICY "user_privacy_settings_update"
  ON public.user_privacy_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Trigger to automatically create public.users on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  
  INSERT INTO public.user_privacy_settings (user_id)
  VALUES (new.id);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
