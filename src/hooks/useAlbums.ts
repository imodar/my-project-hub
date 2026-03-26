import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";
import { useOfflineFirst } from "./useOfflineFirst";
import { useOfflineMutation } from "./useOfflineMutation";

export function useAlbums() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const key = ["albums", familyId];

  const apiFn = useCallback(async () => {
    if (!familyId) return { data: [], error: null };
    const { data: response, error } = await supabase.functions.invoke("albums-api", {
      body: { action: "get-albums", family_id: familyId },
    });
    if (error) return { data: [], error: error.message };
    if (response?.error) return { data: [], error: response.error };
    return { data: response?.data || [], error: null };
  }, [familyId]);

  const { data: albums, isLoading, refetch } = useOfflineFirst<any>({
    table: "albums",
    queryKey: key,
    apiFn,
    enabled: !!familyId,
  });

  const createAlbum = useOfflineMutation<any, any>({
    table: "albums", operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { data: response, error } = await supabase.functions.invoke("albums-api", {
        body: { action: "create-album", family_id: familyId, name: rest.name, cover_color: rest.cover_color, linked_trip_id: rest.linked_trip_id },
      });
      return { data: response?.data ?? null, error: response?.error || error?.message || null };
    },
    queryKey: key, onSuccess: () => refetch(),
  });

  const deleteAlbum = useOfflineMutation<any, any>({
    table: "albums", operation: "DELETE",
    apiFn: async (input) => {
      const { data: response, error } = await supabase.functions.invoke("albums-api", {
        body: { action: "delete-album", id: input.id },
      });
      return { data: null, error: response?.error || error?.message || null };
    },
    queryKey: key,
  });

  const addPhoto = useOfflineMutation<any, any>({
    table: "album_photos", operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input;
      const { data: response, error } = await supabase.functions.invoke("albums-api", {
        body: { action: "add-photo", album_id: rest.album_id, url: rest.url, caption: rest.caption, date: rest.date },
      });
      return { data: response?.data ?? null, error: response?.error || error?.message || null };
    },
    queryKey: key, onSuccess: () => refetch(),
  });

  const deletePhoto = useOfflineMutation<any, any>({
    table: "album_photos", operation: "DELETE",
    apiFn: async (input) => {
      const { data: response, error } = await supabase.functions.invoke("albums-api", {
        body: { action: "delete-photo", id: input.id },
      });
      return { data: null, error: response?.error || error?.message || null };
    },
    queryKey: key,
  });

  return {
    albums: albums || [], isLoading,
    createAlbum: {
      ...createAlbum,
      mutate: (input: any) => createAlbum.mutate({ id: crypto.randomUUID(), created_at: new Date().toISOString(), family_id: familyId, album_photos: [], ...input }),
      mutateAsync: async (input: any) => createAlbum.mutateAsync({ id: crypto.randomUUID(), created_at: new Date().toISOString(), family_id: familyId, album_photos: [], ...input }),
    },
    deleteAlbum: {
      ...deleteAlbum,
      mutate: (albumId: string) => deleteAlbum.mutate({ id: albumId }),
      mutateAsync: async (albumId: string) => deleteAlbum.mutateAsync({ id: albumId }),
    },
    addPhoto: {
      ...addPhoto,
      mutate: (input: any) => addPhoto.mutate({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...input }),
      mutateAsync: async (input: any) => addPhoto.mutateAsync({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...input }),
    },
    deletePhoto: {
      ...deletePhoto,
      mutate: (photoId: string) => deletePhoto.mutate({ id: photoId }),
      mutateAsync: async (photoId: string) => deletePhoto.mutateAsync({ id: photoId }),
    },
  };
}
