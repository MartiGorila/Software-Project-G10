-- Apply this manually to the live Supabase database before running the
-- friend requests + visibility backend in CI or production.

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

ALTER TABLE public.events
DROP CONSTRAINT IF EXISTS events_visibility_check;

ALTER TABLE public.events
ADD CONSTRAINT events_visibility_check
CHECK (visibility IN ('public', 'friends', 'private'));

ALTER TABLE public.plans
ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

ALTER TABLE public.plans
DROP CONSTRAINT IF EXISTS plans_visibility_check;

ALTER TABLE public.plans
ADD CONSTRAINT plans_visibility_check
CHECK (visibility IN ('public', 'friends', 'private'));

CREATE TABLE IF NOT EXISTS public.friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE (requester_id, recipient_id)
);
