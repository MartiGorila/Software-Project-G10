-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.
-- Software Project G10
-- Supabase PostgreSQL schema
-- Generated May 2026

CREATE TABLE public.event_participants (
  user_id uuid NOT NULL,
  event_id uuid NOT NULL,
  joined_at timestamp with time zone DEFAULT now(),
  CONSTRAINT event_participants_pkey PRIMARY KEY (user_id, event_id),
  CONSTRAINT event_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT event_participants_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id)
);
CREATE TABLE public.event_tags (
  event_id uuid NOT NULL,
  tag_id integer NOT NULL,
  CONSTRAINT event_tags_pkey PRIMARY KEY (event_id, tag_id),
  CONSTRAINT event_tags_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT event_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id)
);
CREATE TABLE public.events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  creator_id uuid,
  name text NOT NULL,
  description text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  event_time timestamp with time zone NOT NULL,
  budget numeric,
  capacity integer,
  visibility text NOT NULL DEFAULT 'public',
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.users(id),
  CONSTRAINT events_visibility_check CHECK (visibility IN ('public', 'friends', 'private'))
);
CREATE TABLE public.friend_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT friend_requests_pkey PRIMARY KEY (id),
  CONSTRAINT friend_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT friend_requests_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT friend_requests_requester_recipient_key UNIQUE (requester_id, recipient_id),
  CONSTRAINT friend_requests_status_check CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled'))
);
CREATE TABLE public.friendships (
  user_id uuid NOT NULL,
  friend_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT friendships_pkey PRIMARY KEY (user_id, friend_id),
  CONSTRAINT friendships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT friendships_friend_id_fkey FOREIGN KEY (friend_id) REFERENCES public.users(id)
);
CREATE TABLE public.plan_tags (
  plan_id uuid NOT NULL,
  tag_id integer NOT NULL,
  CONSTRAINT plan_tags_pkey PRIMARY KEY (plan_id, tag_id),
  CONSTRAINT plan_tags_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id),
  CONSTRAINT plan_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id)
);
CREATE TABLE public.plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  creator_id uuid,
  name text NOT NULL,
  description text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  budget numeric,
  visibility text NOT NULL DEFAULT 'public',
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT plans_pkey PRIMARY KEY (id),
  CONSTRAINT plans_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.users(id),
  CONSTRAINT plans_visibility_check CHECK (visibility IN ('public', 'friends', 'private'))
);
CREATE TABLE public.tags (
  id integer NOT NULL DEFAULT nextval('tags_id_seq'::regclass),
  name text NOT NULL UNIQUE,
  CONSTRAINT tags_pkey PRIMARY KEY (id)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  password_hash text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
