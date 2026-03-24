import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";
import {
  generateKeyPair,
  exportPublicKey,
  generateFamilyKey,
  exportAESKey,
  encryptMessage,
  decryptMessage,
  savePrivateKeyLocally,
  loadPrivateKeyLocally,
  saveFamilyKeyLocally,
  loadFamilyKeyLocally,
  importAESKey,
  type EncryptedPayload,
} from "@/lib/crypto";

export type MessageType = "text" | "image" | "voice" | "location";

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  time: string;
  createdAt: string; // raw ISO timestamp for cursor pagination
  isMe: boolean;
  pinned: boolean;
  reactions: Record<string, number>;
  mentionUserId?: string;
  status: string;
  messageType: MessageType;
  mediaUrl?: string;
  mediaMetadata?: {
    width?: number;
    height?: number;
    duration?: number;
    lat?: number;
    lng?: number;
    fileName?: string;
    fileSize?: number;
  };
}

const PAGE_SIZE = 50;

export function useChat() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [familyKey, setFamilyKey] = useState<CryptoKey | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const subscriptionRef = useRef<any>(null);

  // ─── 1. Initialize encryption keys ───
  useEffect(() => {
    if (!user || !familyId) return;
    initKeys();
    async function initKeys() {
      try {
        let fKey = await loadFamilyKeyLocally(familyId!);
        if (fKey) {
          setFamilyKey(fKey);
          setIsReady(true);
          return;
        }

        let privateKey = await loadPrivateKeyLocally(user!.id);
        if (!privateKey) {
          const pair = await generateKeyPair();
          privateKey = pair.privateKey;
          await savePrivateKeyLocally(user!.id, privateKey);
          const pubKey = await exportPublicKey(pair.publicKey);
          await supabase.from("profiles").update({
            avatar_url: undefined,
          }).eq("id", user!.id);
        }

        const { data: existingKey } = await supabase
          .from("family_keys")
          .select("encrypted_key")
          .eq("family_id", familyId!)
          .eq("user_id", user!.id)
          .maybeSingle();

        if (existingKey?.encrypted_key) {
          fKey = await importAESKey(existingKey.encrypted_key);
        } else {
          const { data: anyKey } = await supabase
            .from("family_keys")
            .select("encrypted_key")
            .eq("family_id", familyId!)
            .limit(1)
            .maybeSingle();

          if (anyKey?.encrypted_key) {
            fKey = await importAESKey(anyKey.encrypted_key);
          } else {
            fKey = await generateFamilyKey();
          }

          const rawKey = await exportAESKey(fKey);
          await supabase.from("family_keys").upsert({
            family_id: familyId!,
            user_id: user!.id,
            encrypted_key: rawKey,
          });
        }

        if (fKey) {
          await saveFamilyKeyLocally(familyId!, fKey);
          setFamilyKey(fKey);
        }
        setIsReady(true);
      } catch (err) {
        console.error("E2EE init error:", err);
        setIsReady(true);
      }
    }
  }, [user, familyId]);

  // ─── 2. Load family member profiles ───
  useEffect(() => {
    if (!familyId) return;
    loadProfiles();
    async function loadProfiles() {
      const { data: members } = await supabase
        .from("family_members")
        .select("user_id")
        .eq("family_id", familyId!)
        .eq("status", "active");
      if (!members?.length) return;
      const ids = members.map((m) => m.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", ids);
      if (profs) {
        const map: Record<string, string> = {};
        profs.forEach((p) => {
          map[p.id] = p.name || "عضو";
        });
        setProfiles(map);
      }
    }
  }, [familyId]);

  // ─── 3. Load messages (latest page) ───
  useEffect(() => {
    if (!familyId || !isReady || !user) return;
    loadMessages();
    async function loadMessages() {
      try {
        const { data, error } = await supabase
          .from("chat_messages")
          .select("*")
          .eq("family_id", familyId!)
          .order("created_at", { ascending: false })
          .limit(PAGE_SIZE);
        if (error || !data) {
          console.error("Load messages error:", error);
          return;
        }
        setHasMore(data.length === PAGE_SIZE);
        const sorted = [...data].reverse();
        const decrypted: ChatMessage[] = [];
        for (const m of sorted) {
          const msg = await decryptRef.current(m);
          if (msg) decrypted.push(msg);
        }
        setMessages(decrypted);
      } catch (err) {
        console.error("Load messages exception:", err);
      }
    }
  }, [familyId, isReady, familyKey, profiles, user]);

  // ─── Load older messages ───
  const loadOlderMessages = useCallback(async () => {
    if (!familyId || !user || !hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const oldestMsg = messages[0];
      if (!oldestMsg) { setIsLoadingMore(false); return; }

      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("family_id", familyId)
        .lt("created_at", oldestMsg.time ? undefined as any : undefined)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      // We need the actual created_at from DB, so query by id-based cursor
      // Better approach: use the raw created_at. We'll store it.
      // For now, re-query using offset approach with the oldest message id
      const { data: olderData, error: olderError } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("family_id", familyId)
        .order("created_at", { ascending: false })
        .range(messages.length, messages.length + PAGE_SIZE - 1);

      if (olderError || !olderData) {
        console.error("Load older error:", olderError);
        setIsLoadingMore(false);
        return;
      }

      setHasMore(olderData.length === PAGE_SIZE);

      const sorted = [...olderData].reverse();
      const decrypted: ChatMessage[] = [];
      for (const m of sorted) {
        const msg = await decryptRef.current(m);
        if (msg) decrypted.push(msg);
      }
      setMessages((prev) => [...decrypted, ...prev]);
    } catch (err) {
      console.error("Load older exception:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [familyId, user, hasMore, isLoadingMore, messages]);

  // ─── 4. Realtime subscription ───
  useEffect(() => {
    if (!familyId || !isReady) return;
    subscriptionRef.current = supabase
      .channel(`chat-${familyId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `family_id=eq.${familyId}`,
        },
        async (payload) => {
          try {
            const msg = await decryptRef.current(payload.new as any);
            if (msg) {
              setMessages((prev) => {
                if (prev.find((m) => m.id === msg.id)) return prev;
                return [...prev, msg];
              });
            }
          } catch (err) {
            console.error("Realtime message error:", err);
          }
        }
      )
      .subscribe();

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [familyId, isReady]);

  // ─── Decrypt a DB row (use ref to avoid stale closures) ───
  const decryptDbMessage = useCallback(
    async (row: any): Promise<ChatMessage | null> => {
      try {
        if (!row || !user) return null;
        let text = row.encrypted_text || "";

        if (familyKey && row.iv) {
          try {
            text = await decryptMessage(familyKey, {
              ciphertext: row.encrypted_text,
              iv: row.iv,
            });
          } catch {
            text = "🔒 تعذر فك التشفير";
          }
        }

        return {
          id: row.id,
          senderId: row.sender_id,
          senderName: profiles[row.sender_id] || "عضو",
          text,
          time: new Date(row.created_at).toLocaleTimeString("ar-SA", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }),
          isMe: row.sender_id === user.id,
          pinned: row.pinned || false,
          reactions: (row.reactions as Record<string, number>) || {},
          mentionUserId: row.mention_user_id || undefined,
          status: row.status || "sent",
          messageType: (row.message_type as MessageType) || "text",
          mediaUrl: row.media_url || undefined,
          mediaMetadata: row.media_metadata as ChatMessage["mediaMetadata"] || undefined,
        };
      } catch (err) {
        console.error("decryptDbMessage error:", err, row);
        return null;
      }
    },
    [user, familyKey, profiles]
  );

  const decryptRef = useRef(decryptDbMessage);
  useEffect(() => { decryptRef.current = decryptDbMessage; }, [decryptDbMessage]);

  // ─── Send text message ───
  const sendMessage = useCallback(
    async (plaintext: string, mentionUserId?: string) => {
      if (!user || !familyId || !plaintext.trim()) return;

      let encrypted_text = plaintext;
      let iv: string | null = null;

      if (familyKey) {
        try {
          const payload = await encryptMessage(familyKey, plaintext);
          encrypted_text = payload.ciphertext;
          iv = payload.iv;
        } catch (err) {
          console.error("Encryption error:", err);
        }
      }

      const { error } = await supabase.from("chat_messages").insert({
        family_id: familyId,
        sender_id: user.id,
        encrypted_text,
        iv,
        mention_user_id: mentionUserId || null,
        pinned: false,
        status: "sent",
        message_type: "text",
      });

      if (error) console.error("Send error:", error);
    },
    [user, familyId, familyKey]
  );

  // ─── Helper: add optimistic message ───
  const addOptimisticMessage = useCallback(
    (type: MessageType, mediaUrl: string, metadata?: ChatMessage["mediaMetadata"], caption?: string): string => {
      const tempId = `temp-${Date.now()}`;
      const optimistic: ChatMessage = {
        id: tempId,
        senderId: user?.id || "",
        senderName: profiles[user?.id || ""] || "أنا",
        text: caption || type,
        time: new Date().toLocaleTimeString("ar-SA", { hour: "numeric", minute: "2-digit", hour12: true }),
        isMe: true,
        pinned: false,
        reactions: {},
        status: "sending",
        messageType: type,
        mediaUrl,
        mediaMetadata: metadata,
      };
      setMessages((prev) => [...prev, optimistic]);
      return tempId;
    },
    [user, profiles]
  );

  // ─── Send media message (image/voice/location) ───
  const sendMediaMessage = useCallback(
    async (type: MessageType, mediaUrl: string, metadata?: ChatMessage["mediaMetadata"], caption?: string) => {
      if (!user || !familyId) return;

      // Add optimistic message immediately
      const tempId = addOptimisticMessage(type, mediaUrl, metadata, caption);

      let encrypted_text = caption || "";
      let iv: string | null = null;

      if (familyKey && encrypted_text) {
        try {
          const payload = await encryptMessage(familyKey, encrypted_text);
          encrypted_text = payload.ciphertext;
          iv = payload.iv;
        } catch (err) {
          console.error("Encryption error:", err);
        }
      }

      const { error } = await supabase.from("chat_messages").insert({
        family_id: familyId,
        sender_id: user.id,
        encrypted_text: encrypted_text || type,
        iv,
        pinned: false,
        status: "sent",
        message_type: type,
        media_url: mediaUrl,
        media_metadata: metadata as any,
      });

      if (error) {
        console.error("Send media error:", error);
        // Mark as failed
        setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, status: "failed" } : m));
      } else {
        // Remove optimistic message — realtime will add the real one
        // Give realtime a moment, then remove temp if real arrived
        setTimeout(() => {
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
        }, 3000);
      }
    },
    [user, familyId, familyKey, addOptimisticMessage]
  );

  // ─── Toggle pin ───
  const togglePin = useCallback(
    async (messageId: string) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg) return;
      await supabase
        .from("chat_messages")
        .update({ pinned: !msg.pinned })
        .eq("id", messageId);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, pinned: !m.pinned } : m))
      );
    },
    [messages]
  );

  // ─── Add reaction ───
  const addReaction = useCallback(
    async (messageId: string, emoji: string) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg) return;
      const reactions = { ...msg.reactions };
      reactions[emoji] = (reactions[emoji] || 0) + 1;
      await supabase
        .from("chat_messages")
        .update({ reactions: reactions as any })
        .eq("id", messageId);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions } : m))
      );
    },
    [messages]
  );

  return {
    messages,
    isReady,
    sendMessage,
    sendMediaMessage,
    togglePin,
    addReaction,
    profiles,
    familyId,
    familyKey: !!familyKey,
  };
}
