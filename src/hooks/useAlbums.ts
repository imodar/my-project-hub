import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";
import { useOfflineFirst } from "./useOfflineFirst";
import { useOfflineMutation } from "./useOfflineMutation";

export interface AlbumPhoto {
  id: string;
  album_id: string;
  url: string;
  caption: string | null;
  date: string | null;
  created_at: string;
}

export interface Album {
  id: string;
  family_id: string;
  name: string;
  cover_color: string | null;
  linked_trip_id: string | null;
  created_by: string;
  created_at: string;
  album_photos: AlbumPhoto[];
}

export function useAlbums() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const qc = useQueryClient();
  const key = ["albums", familyId];

  const apiFn = useCallback(async (since?: string | null) => {
    if (!familyId) return { data: [] as Album[], error: null };
    const { data: response, error } = await supabase.functions.invoke("albums-api", {
      body: { action: "get-albums", family_id: familyId, ...(since ? { since } : {}) },
    });
    if (error) return { data: [] as Album[], error: error.message };
    if (response?.error) return { data: [] as Album[], error: response.error };
    return { data: (response?.data || []) as Album[], error: null };
  }, [familyId]);

  const { data: albums, isLoading, refetch } = useOfflineFirst<Album>({
    table: "albums",
    queryKey: key,
    apiFn,
    enabled: !!familyId,
    scopeKey: familyId ?? undefined,
  });

  // Helper: optimistic update for photos inside an album
  const optimisticAlbumSub = useCallback(
    (albumId: string, updater: (photos: AlbumPhoto[]) => AlbumPhoto[]) => {
      qc.setQueryData<Album[]>(key, (old) => {
        if (!old) return old;
        return old.map((a) =>
          a.id === albumId ? { ...a, album_photos: updater(a.album_photos || []) } : a
        );
      });
    },
    [qc, key]
  );

  const createAlbum = useOfflineMutation<Album, Partial<Album>>({
    table: "albums", operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input as Album;
      const { data: response, error } = await supabase.functions.invoke("albums-api", {
        body: { action: "create-album", family_id: familyId, name: rest.name, cover_color: rest.cover_color, linked_trip_id: rest.linked_trip_id },
      });
      return { data: response?.data ?? null, error: response?.error || error?.message || null };
    },
    queryKey: key,
  });

  const deleteAlbum = useOfflineMutation<null, { id: string }>({
    table: "albums", operation: "DELETE",
    apiFn: async (input) => {
      const { data: response, error } = await supabase.functions.invoke("albums-api", {
        body: { action: "delete-album", id: input.id },
      });
      return { data: null, error: response?.error || error?.message || null };
    },
    queryKey: key,
  });

  const addPhoto = useOfflineMutation<AlbumPhoto, Partial<AlbumPhoto>>({
    table: "album_photos", operation: "INSERT",
    apiFn: async (input) => {
      const { id, created_at, ...rest } = input as AlbumPhoto;
      const { data: response, error } = await supabase.functions.invoke("albums-api", {
        body: { action: "add-photo", album_id: rest.album_id, url: rest.url, caption: rest.caption, date: rest.date },
      });
      return { data: response?.data ?? null, error: response?.error || error?.message || null };
    },
    onSuccess: () => refetch(),
  });

  const deletePhoto = useOfflineMutation<null, { id: string }>({
    table: "album_photos", operation: "DELETE",
    apiFn: async (input) => {
      const { data: response, error } = await supabase.functions.invoke("albums-api", {
        body: { action: "delete-photo", id: input.id },
      });
      return { data: null, error: response?.error || error?.message || null };
    },
    onSuccess: () => refetch(),
  });

  return {
    albums: albums || [], isLoading,
    createAlbum: {
      ...createAlbum,
      mutate: (input: Partial<Album>) => createAlbum.mutate({ id: crypto.randomUUID(), created_at: new Date().toISOString(), family_id: familyId, album_photos: [], ...input } as Album),
      mutateAsync: async (input: Partial<Album>) => createAlbum.mutateAsync({ id: crypto.randomUUID(), created_at: new Date().toISOString(), family_id: familyId, album_photos: [], ...input } as Album),
    },
    deleteAlbum: {
      ...deleteAlbum,
      mutate: (albumId: string) => deleteAlbum.mutate({ id: albumId }),
      mutateAsync: async (albumId: string) => deleteAlbum.mutateAsync({ id: albumId }),
    },
    addPhoto: {
      ...addPhoto,
      mutate: (input: Partial<AlbumPhoto>) => {
        const item = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...input } as AlbumPhoto;
        optimisticAlbumSub(input.album_id!, (photos) => [...photos, item]);
        addPhoto.mutate(item);
      },
      mutateAsync: async (input: Partial<AlbumPhoto>) => {
        const item = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...input } as AlbumPhoto;
        optimisticAlbumSub(input.album_id!, (photos) => [...photos, item]);
        return addPhoto.mutateAsync(item);
      },
    },
    deletePhoto: {
      ...deletePhoto,
      mutate: (photoId: string, albumId?: string) => {
        if (albumId) optimisticAlbumSub(albumId, (photos) => photos.filter((p) => p.id !== photoId));
        deletePhoto.mutate({ id: photoId });
      },
      mutateAsync: async (photoId: string, albumId?: string) => {
        if (albumId) optimisticAlbumSub(albumId, (photos) => photos.filter((p) => p.id !== photoId));
        return deletePhoto.mutateAsync({ id: photoId });
      },
    },
  };
}
