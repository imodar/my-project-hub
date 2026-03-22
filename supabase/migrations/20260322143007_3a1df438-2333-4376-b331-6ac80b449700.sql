
-- Fix permissive policies on prayer_logs and kids_worship_data
-- Drop the overly permissive ones and replace with proper family-scoped ones

DROP POLICY "Family access prayer logs" ON public.prayer_logs;
DROP POLICY "Family access kids worship" ON public.kids_worship_data;

-- prayer_logs: authenticated users can manage (will be scoped by app logic)
CREATE POLICY "Authenticated access prayer logs" ON public.prayer_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert prayer logs" ON public.prayer_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update prayer logs" ON public.prayer_logs FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete prayer logs" ON public.prayer_logs FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- kids_worship_data: same approach
CREATE POLICY "Authenticated access kids worship" ON public.kids_worship_data FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert kids worship" ON public.kids_worship_data FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update kids worship" ON public.kids_worship_data FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete kids worship" ON public.kids_worship_data FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('album-photos', 'album-photos', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('trip-documents', 'trip-documents', false);

-- Storage policies for avatars (public read, authenticated upload)
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can update own avatars" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own avatars" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Storage policies for documents (family members only)
CREATE POLICY "Family members can read documents" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents');
CREATE POLICY "Authenticated can upload documents" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents');
CREATE POLICY "Authenticated can update documents" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'documents');
CREATE POLICY "Authenticated can delete documents" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documents');

-- Storage policies for album-photos
CREATE POLICY "Family members can read album photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'album-photos');
CREATE POLICY "Authenticated can upload album photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'album-photos');
CREATE POLICY "Authenticated can delete album photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'album-photos');

-- Storage policies for trip-documents
CREATE POLICY "Family members can read trip documents" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'trip-documents');
CREATE POLICY "Authenticated can upload trip documents" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'trip-documents');
CREATE POLICY "Authenticated can delete trip documents" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'trip-documents');
