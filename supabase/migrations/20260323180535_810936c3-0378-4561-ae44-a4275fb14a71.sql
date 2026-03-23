
-- Add media columns to chat_messages
ALTER TABLE public.chat_messages 
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_metadata jsonb;

-- Create chat-media storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Family members can upload to chat-media
CREATE POLICY "Family members upload chat media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND (storage.foldername(name))[1] IN (
    SELECT fm.family_id::text FROM public.family_members fm
    WHERE fm.user_id = auth.uid() AND fm.status = 'active'
  )
);

-- RLS: Family members can view chat media
CREATE POLICY "Family members view chat media"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (storage.foldername(name))[1] IN (
    SELECT fm.family_id::text FROM public.family_members fm
    WHERE fm.user_id = auth.uid() AND fm.status = 'active'
  )
);

-- RLS: Users can delete own uploads
CREATE POLICY "Users delete own chat media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chat-media'
  AND owner = auth.uid()
);
