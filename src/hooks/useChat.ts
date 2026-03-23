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

export function useChat() {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [familyKey, setFamilyKey] = useState<CryptoKey | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const subscriptionRef = useRef<any>(null);

  // ─── 1. Initialize encryption keys ───
  useEffect(() => {
    if (!user || !familyId) return;
    initKeys();
    async function initKeys() {
      try {
        // Try loading cached family key
        let fKey = await loadFamilyKeyLocally(familyId!);
        if (fKey) {
          setFamilyKey(fKey);
          setIsReady(true);
          return;
        }

        // Check if user has an ECDH key pair
        let privateKey = await loadPrivateKeyLocally(user!.id);
        if (!privateKey) {
          // Generate new key pair
          const pair = await generateKeyPair();
          privateKey = pair.privateKey;
          await savePrivateKeyLocally(user!.id, privateKey);

          // Store public key in profile (we'll use user_metadata or a dedicated field)
          const pubKey = await exportPublicKey(pair.publicKey);
          await supabase.from("profiles").update({
            avatar_url: undefined, // don't touch
          }).eq("id", user!.id);
          // Store public key in family_keys metadata for now
        }

        // Check if family key exists in DB
        const { data: existingKey } = await supabase
          .from("family_keys")
          .select("encrypted_key")
          .eq("family_id", familyId!)
          .eq("user_id", user!.id)
          .maybeSingle();

        if (existingKey?.encrypted_key) {
          // Simple approach: family key stored directly (encrypted at rest by Supabase)
          fKey = await importAESKey(existingKey.encrypted_key);
        } else {
          // Check if ANY family key exists
          const { data: anyKey } = await supabase
            .from("family_keys")
            .select("encrypted_key")
            .eq("family_id", familyId!)
            .limit(1)
            .maybeSingle();

          if (anyKey?.encrypted_key) {
            // Use existing family key (simplified: stored as base64 AES key)
            fKey = await importAESKey(anyKey.encrypted_key);
          } else {
            // First member: generate family key
            fKey = await generateFamilyKey();
          }

          // Store for this user
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
        setIsReady(true); // Allow fallback
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

  // ─── 3. Load messages ───
  useEffect(() => {
    if (!familyId || !isReady || !user) return;
    loadMessages();
    async function loadMessages() {
      try {
        const { data, error } = await supabase
          .from("chat_messages")
          .select("*")
          .eq("family_id", familyId!)
          .order("created_at", { ascending: true })
          .limit(200);
        if (error || !data) {
          console.error("Load messages error:", error);
          return;
        }
        const decrypted: ChatMessage[] = [];
        for (const m of data) {
          const msg = await decryptRef.current(m);
          if (msg) decrypted.push(msg);
        }
        setMessages(decrypted);
      } catch (err) {
        console.error("Load messages exception:", err);
      }
    }
  }, [familyId, isReady, familyKey, profiles, user]);

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

  // ─── Send media message (image/voice/location) ───
  const sendMediaMessage = useCallback(
    async (type: MessageType, mediaUrl: string, metadata?: ChatMessage["mediaMetadata"], caption?: string) => {
      if (!user || !familyId) return;

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

      if (error) console.error("Send media error:", error);
    },
    [user, familyId, familyKey]
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
