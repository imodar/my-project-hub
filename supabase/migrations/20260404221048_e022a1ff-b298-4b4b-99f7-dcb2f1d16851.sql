-- Drop overly-broad SELECT policies (no family check)
DROP POLICY IF EXISTS "Family members can read album photos" ON storage.objects;
DROP POLICY IF EXISTS "Family members can read documents" ON storage.objects;
DROP POLICY IF EXISTS "Family members can read trip documents" ON storage.objects;

-- Drop overly-broad DELETE policies
DROP POLICY IF EXISTS "Authenticated can delete album photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete trip documents" ON storage.objects;

-- Drop overly-broad INSERT policies
DROP POLICY IF EXISTS "Authenticated can upload album photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload trip documents" ON storage.objects;