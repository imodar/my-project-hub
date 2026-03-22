-- Storage RLS policies for all buckets

-- Avatars (public bucket)
CREATE POLICY "Anyone can view avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users upload own avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Documents (private)
CREATE POLICY "Family members access documents" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.is_family_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND public.is_family_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- Album photos (private)
CREATE POLICY "Family members access album photos" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'album-photos'
    AND public.is_family_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
    AND NOT public.is_staff_member(auth.uid())
  )
  WITH CHECK (
    bucket_id = 'album-photos'
    AND public.is_family_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
    AND NOT public.is_staff_member(auth.uid())
  );

-- Trip documents (private)
CREATE POLICY "Family members access trip documents" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'trip-documents'
    AND public.is_family_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
  WITH CHECK (
    bucket_id = 'trip-documents'
    AND public.is_family_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );