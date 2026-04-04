
INSERT INTO storage.buckets (id, name, public) VALUES ('design-outputs', 'design-outputs', true);

CREATE POLICY "Design outputs are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'design-outputs');

CREATE POLICY "Authenticated users can upload design outputs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'design-outputs' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own design outputs"
ON storage.objects FOR UPDATE
USING (bucket_id = 'design-outputs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own design outputs"
ON storage.objects FOR DELETE
USING (bucket_id = 'design-outputs' AND auth.uid()::text = (storage.foldername(name))[1]);
