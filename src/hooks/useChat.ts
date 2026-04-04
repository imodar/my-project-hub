import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "./useFamilyId";
import { db } from "@/lib/db";
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
  createdAt: string;
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
  const [cachedLoaded, setCachedLoaded] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const subscriptionRef = useRef<any>(null);

  // ─── 0. Load cached messages from IndexedDB instantly ───
  useEffect(() => {
    if (!user || !familyId) return;
    (async () => {
      try {
        const cached = await db.chat_messages
          .where("family_id").equals(familyId)
          .reverse().sortBy("created_at");
        if (cached.length > 0) {
          const recent = cached.slice(0, PAGE_SIZE).reverse();
          const mapped: ChatMessage[] = recent.map((row: any) => ({
            id: row.id,
            senderId: row.sender_id,
            senderName: row.sender_name_cache || "عضو",
            text: row.plain_text_cache || row.encrypted_text || "🔒",
            time: new Date(row.created_at).toLocaleTimeString("ar-SA", { hour: "numeric", minute: "2-digit", hour12: true }),
            createdAt: row.created_at,
            isMe: row.sender_id === user.id,
            pinned: row.pinned || false,
            reactions: (row.reactions as Record<string, number>) || {},
            mentionUserId: row.mention_user_id || undefined,
            status: row.status || "sent",
            messageType: (row.message_type as MessageType) || "text",
            mediaUrl: row.media_url || undefined,
            mediaMetadata: row.media_metadata || undefined,
          }));
          setMessages(mapped);
        }
        setCachedLoaded(true);
      } catch (e) {
        console.warn("[Chat] Failed to load cached messages:", e);
        setCachedLoaded(true);
      }
    })();
  }, [user, familyId]);

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
          // Public key exported for potential future use (key exchange)
          await exportPublicKey(pair.publicKey);
        }

        // Get existing key via chat-api
        const { data: existingKeyData } = await supabase.functions.invoke("chat-api", {
          body: { action: "get-family-key", family_id: familyId },
        });

        if (existingKeyData?.data?.encrypted_key) {
          fKey = await importAESKey(existingKeyData.data.encrypted_key);
        } else {
          // Try getting any family key
          const { data: anyKeyData } = await supabase.functions.invoke("chat-api", {
            body: { action: "get-any-family-key", family_id: familyId },
          });

          if (anyKeyData?.data?.encrypted_key) {
            fKey = await importAESKey(anyKeyData.data.encrypted_key);
          } else {
            fKey = await generateFamilyKey();
          }

          // Upsert the key
          const rawKey = await exportAESKey(fKey);
          await supabase.functions.invoke("chat-api", {
            body: { action: "upsert-family-key", family_id: familyId, encrypted_key: rawKey },
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

  // ─── 2. Load family member profiles via chat-api ───
  useEffect(() => {
    if (!familyId) return;
    loadProfiles();
    async function loadProfiles() {
      const { data } = await supabase.functions.invoke("chat-api", {
        body: { action: "get-chat-members", family_id: familyId },
      });
      const profs = data?.data;
      if (profs && Array.isArray(profs)) {
        const map: Record<string, string> = {};
        profs.forEach((p: any) => {
          map[p.id] = p.name || "عضو";
        });
        setProfiles(map);
      }
    }
  }, [familyId]);

  // ─── 3. Load messages via chat-api & cache locally ───
  useEffect(() => {
    if (!familyId || !isReady || !user) return;
    loadMessages();
    async function loadMessages() {
      try {
        const { data: result } = await supabase.functions.invoke("chat-api", {
          body: { action: "get-messages", family_id: familyId, limit: PAGE_SIZE },
        });
        const msgData = result?.data;
        if (!msgData) return;
        setHasMore(msgData.length === PAGE_SIZE);
        const decrypted: ChatMessage[] = [];
        for (const m of msgData) {
          const msg = await decryptRef.current(m);
          if (msg) decrypted.push(msg);
        }
        setMessages(decrypted);

        // Cache to IndexedDB for instant load next time
        try {
          const toCache = msgData.map((m: any, i: number) => ({
            ...m,
            plain_text_cache: decrypted[i]?.text || "",
            sender_name_cache: decrypted[i]?.senderName || "",
          }));
          await db.chat_messages.bulkPut(toCache);
        } catch (e) {
          console.warn("[Chat] Cache write failed:", e);
        }
      } catch (err) {
        console.error("Load messages exception:", err);
      }
    }
  }, [familyId, isReady, familyKey, profiles, user]);

  // ─── Load older messages via chat-api ───
  const loadOlderMessages = useCallback(async () => {
    if (!familyId || !user || !hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const oldestMsg = messages[0];
      if (!oldestMsg?.createdAt) { setIsLoadingMore(false); return; }

      const { data: result } = await supabase.functions.invoke("chat-api", {
        body: { action: "get-messages", family_id: familyId, limit: PAGE_SIZE, before: oldestMsg.createdAt },
      });
      const msgData = result?.data;
      if (!msgData) { setIsLoadingMore(false); return; }

      setHasMore(msgData.length === PAGE_SIZE);

      const decrypted: ChatMessage[] = [];
      for (const m of msgData) {
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

  // ─── 4. Realtime subscription (kept — read-only listener) ───
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

  // ─── Decrypt a DB row ───
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
          createdAt: row.created_at,
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

  // ─── Send text message via chat-api ───
  const sendMessage = useCallback(
    async (plaintext: string, mentionUserId?: string) => {
      if (!user || !familyId || !plaintext.trim()) return;

      const tempId = `temp-${Date.now()}`;
      const optimistic: ChatMessage = {
        id: tempId,
        senderId: user.id,
        senderName: profiles[user.id] || "أنا",
        text: plaintext,
        time: new Date().toLocaleTimeString("ar-SA", { hour: "numeric", minute: "2-digit", hour12: true }),
        createdAt: new Date().toISOString(),
        isMe: true,
        pinned: false,
        reactions: {},
        mentionUserId: mentionUserId || undefined,
        status: "sending",
        messageType: "text",
      };
      setMessages((prev) => [...prev, optimistic]);

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

      const { error } = await supabase.functions.invoke("chat-api", {
        body: {
          action: "send-message",
          family_id: familyId,
          encrypted_text,
          iv,
          mention_user_id: mentionUserId || null,
        },
      });

      if (error) {
        console.error("Send error:", error);
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m))
        );
      } else {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: "sent" } : m))
        );
      }
    },
    [user, familyId, familyKey, profiles]
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
        createdAt: new Date().toISOString(),
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

  // ─── Send media message via chat-api ───
  const sendMediaMessage = useCallback(
    async (type: MessageType, mediaUrl: string, metadata?: ChatMessage["mediaMetadata"], caption?: string) => {
      if (!user || !familyId) return;

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

      const { error } = await supabase.functions.invoke("chat-api", {
        body: {
          action: "send-message",
          family_id: familyId,
          encrypted_text: encrypted_text || type,
          iv,
        },
      });

      if (error) {
        console.error("Send media error:", error);
        setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, status: "failed" } : m));
      } else {
        setTimeout(() => {
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
        }, 3000);
      }
    },
    [user, familyId, familyKey, addOptimisticMessage]
  );

  // ─── Retry failed message ───
  const retryMessage = useCallback(
    async (messageId: string) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg || msg.status !== "failed") return;

      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, status: "sending" } : m))
      );

      let encrypted_text = msg.text;
      let iv: string | null = null;

      if (familyKey) {
        try {
          const payload = await encryptMessage(familyKey, msg.text);
          encrypted_text = payload.ciphertext;
          iv = payload.iv;
        } catch (err) {
          console.error("Encryption error:", err);
        }
      }

      const { error } = await supabase.functions.invoke("chat-api", {
        body: {
          action: "send-message",
          family_id: familyId!,
          encrypted_text: encrypted_text || msg.messageType,
          iv,
          mention_user_id: msg.mentionUserId || null,
        },
      });

      if (error) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, status: "failed" } : m))
        );
      } else {
        if (msg.messageType === "text") {
          setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? { ...m, status: "sent" } : m))
          );
        } else {
          setTimeout(() => {
            setMessages((prev) => prev.filter((m) => m.id !== messageId));
          }, 3000);
        }
      }
    },
    [messages, user, familyId, familyKey]
  );

  // ─── Toggle pin via chat-api ───
  const togglePin = useCallback(
    async (messageId: string) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg) return;
      await supabase.functions.invoke("chat-api", {
        body: { action: "pin-message", id: messageId, pinned: !msg.pinned },
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, pinned: !m.pinned } : m))
      );
    },
    [messages]
  );

  // ─── Add reaction via chat-api ───
  const addReaction = useCallback(
    async (messageId: string, emoji: string) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg) return;
      const reactions = { ...msg.reactions };
      reactions[emoji] = (reactions[emoji] || 0) + 1;
      await supabase.functions.invoke("chat-api", {
        body: { action: "react", id: messageId, reactions },
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions } : m))
      );
    },
    [messages]
  );

  return {
    messages,
    isReady,
    cachedLoaded,
    sendMessage,
    sendMediaMessage,
    retryMessage,
    togglePin,
    addReaction,
    profiles,
    familyId,
    familyKey: !!familyKey,
    hasMore,
    isLoadingMore,
    loadOlderMessages,
  };
}
