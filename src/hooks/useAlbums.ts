import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";

export function useAlbums() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const qc = useQueryClient();
  const key = ["albums", familyId];

  const albumsQuery = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!familyId) return [];
      const { data, error } = await supabase
        .from("albums")
        .select("*, album_photos(*)")
        .eq("family_id", familyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!familyId,
  });

  const createAlbum = useMutation({
    mutationFn: async (input: { name: string; cover_color?: string; linked_trip_id?: string }) => {
      if (!familyId || !user) throw new Error("No family");
      const { error } = await supabase.from("albums").insert({
        name: input.name,
        cover_color: input.cover_color,
        linked_trip_id: input.linked_trip_id,
        family_id: familyId,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteAlbum = useMutation({
    mutationFn: async (albumId: string) => {
      const { error } = await supabase.from("albums").delete().eq("id", albumId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const addPhoto = useMutation({
    mutationFn: async (input: { album_id: string; url: string; caption?: string; date?: string }) => {
      const { error } = await supabase.from("album_photos").insert(input);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deletePhoto = useMutation({
    mutationFn: async (photoId: string) => {
      const { error } = await supabase.from("album_photos").delete().eq("id", photoId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { albums: albumsQuery.data || [], isLoading: albumsQuery.isLoading, createAlbum, deleteAlbum, addPhoto, deletePhoto };
}
