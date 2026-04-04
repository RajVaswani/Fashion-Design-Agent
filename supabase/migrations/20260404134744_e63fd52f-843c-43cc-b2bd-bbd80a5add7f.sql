
-- Collections
CREATE TABLE public.collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own collections" ON public.collections
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Collection images
CREATE TABLE public.collection_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  src TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'image',
  selected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.collection_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own images" ON public.collection_images
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_collection_images_collection ON public.collection_images(collection_id);

-- Image annotations
CREATE TABLE public.image_annotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  image_id UUID NOT NULL REFERENCES public.collection_images(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  x DOUBLE PRECISION NOT NULL,
  y DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.image_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own annotations" ON public.image_annotations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.collection_images ci WHERE ci.id = image_id AND ci.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.collection_images ci WHERE ci.id = image_id AND ci.user_id = auth.uid())
  );

CREATE INDEX idx_image_annotations_image ON public.image_annotations(image_id);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_collections_updated_at
  BEFORE UPDATE ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
