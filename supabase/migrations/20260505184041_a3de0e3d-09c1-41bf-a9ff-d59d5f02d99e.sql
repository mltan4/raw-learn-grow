
CREATE TABLE public.webinars (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  presenter TEXT,
  notes TEXT NOT NULL,
  watched_at DATE NOT NULL DEFAULT CURRENT_DATE,
  generated_post TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.webinars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own webinars" ON public.webinars
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own webinars" ON public.webinars
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own webinars" ON public.webinars
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own webinars" ON public.webinars
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_webinars_updated_at
  BEFORE UPDATE ON public.webinars
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_webinars_user_watched ON public.webinars(user_id, watched_at DESC);
