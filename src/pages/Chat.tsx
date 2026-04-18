import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Send, Pin, Lock, Smile, Check, CheckCheck, ShieldCheck, Plus, Image, Mic, MapPin, Play, Pause, Square, X, Loader2, AlertCircle, RotateCcw, ImageOff } from "lucide-react";
import { useMediaUrl } from "@/hooks/useMediaUrl";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { useChat, type ChatMessage } from "@/hooks/useChat";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { appToast } from "@/lib/toast";
import { supabase } from "@/integrations/supabase/client";
import { validateFile } from "@/lib/storage";

const emojiOptions = ["❤️", "👍", "😂", "😮", "😢", "🤲"];

const StatusIcon = ({ status }: { status: string }) => {
  if (status === "sending") return <Loader2 size={14} className="text-white/50 animate-spin" />;
  if (status === "failed") return <AlertCircle size={14} className="text-destructive" />;
  if (status === "sent") return <Check size={14} className="text-white/50" />;
  if (status === "delivered") return <CheckCheck size={14} className="text-white/50" />;
  return <CheckCheck size={14} className="text-blue-400" />;
};

// ─── Voice Player ───
const VoicePlayer = ({ url, isMe }: { url: string; isMe: boolean }) => {
  const { url: mediaUrl, status } = useMediaUrl(url);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  if (status === "loading") {
    return (
      <div className="flex items-center gap-2 min-w-[180px] justify-center py-2">
        <Loader2 size={18} className="animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">جاري تحميل الصوت...</span>
      </div>
    );
  }

  if (status === "error" || !mediaUrl) {
    return (
      <div className="flex items-center gap-2 min-w-[180px] justify-center py-2">
        <AlertCircle size={16} className="text-destructive" />
        <span className="text-xs text-muted-foreground">تعذر تحميل الصوت</span>
      </div>
    );
  }

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <audio
        ref={audioRef}
        src={mediaUrl}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }}
        preload="metadata"
      />
      <button onClick={toggle} className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isMe ? "bg-white/20" : "bg-primary/10"}`}>
        {playing ? <Pause size={14} className={isMe ? "text-white" : "text-primary"} /> : <Play size={14} className={isMe ? "text-white" : "text-primary"} />}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div className={`h-1 rounded-full overflow-hidden ${isMe ? "bg-white/20" : "bg-muted"}`}>
          <div
            className={`h-full rounded-full transition-all ${isMe ? "bg-white/70" : "bg-primary"}`}
            style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }}
          />
        </div>
        <span className={`text-[10px] ${isMe ? "text-white/50" : "text-muted-foreground"}`}>
          {Math.floor((duration - currentTime) / 60)}:{String(Math.floor((duration - currentTime) % 60)).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
};

// ─── Location Bubble ───
const LocationBubble = ({ lat, lng, isMe }: { lat: number; lng: number; isMe: boolean }) => (
  <a
    href={`https://www.google.com/maps?q=${lat},${lng}`}
    target="_blank"
    rel="noopener noreferrer"
    className="block"
  >
    <div className={`flex items-center gap-2 px-1 py-1 rounded-lg ${isMe ? "bg-white/10" : "bg-muted/50"}`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isMe ? "bg-white/20" : "bg-primary/10"}`}>
        <MapPin size={18} className={isMe ? "text-white" : "text-primary"} />
      </div>
      <div>
        <p className={`text-xs font-semibold ${isMe ? "text-white" : "text-foreground"}`}>📍 موقع مشترك</p>
        <p className={`text-[10px] ${isMe ? "text-white/50" : "text-muted-foreground"}`}>
          {lat.toFixed(4)}, {lng.toFixed(4)}
        </p>
      </div>
    </div>
  </a>
);

// ─── Image Bubble ───
const ImageBubble = ({ url }: { url: string }) => {
  const { url: mediaUrl, status } = useMediaUrl(url);
  const [fullscreen, setFullscreen] = useState(false);

  if (status === "loading") {
    return (
      <div className="rounded-xl bg-muted/50 flex items-center justify-center w-48 h-36">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "error" || !mediaUrl) {
    return (
      <div className="rounded-xl bg-muted/30 border border-border flex flex-col items-center justify-center w-48 h-36 gap-1">
        <ImageOff size={20} className="text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">تعذر تحميل الصورة</span>
      </div>
    );
  }

  return (
    <>
      <img
        src={mediaUrl}
        alt="صورة"
        className="rounded-xl max-w-full max-h-60 object-cover cursor-pointer"
        onClick={() => setFullscreen(true)}
      />
      {fullscreen && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center" onClick={() => setFullscreen(false)}>
          <button className="absolute top-4 left-4 text-white z-10" onClick={() => setFullscreen(false)}>
            <X size={28} />
          </button>
          <img src={mediaUrl} alt="صورة" className="max-w-[95vw] max-h-[90vh] object-contain" />
        </div>
      )}
    </>
  );
};

// ─── Voice Recorder ───
const VoiceRecorder = ({ onRecorded, onCancel }: { onRecorded: (blob: Blob) => void; onCancel: () => void }) => {
  const [recording, setRecording] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number>(0);

  useEffect(() => {
    let stream: MediaStream;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4" });
        mediaRecorderRef.current = mr;
        chunksRef.current = [];
        mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        mr.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: mr.mimeType });
          stream.getTracks().forEach(t => t.stop());
          onRecorded(blob);
        };
        mr.start();
        timerRef.current = window.setInterval(() => setElapsed(p => p + 1), 1000);
      } catch {
        appToast.error("تعذر الوصول للميكروفون");
        onCancel();
      }
    })();
    return () => { clearInterval(timerRef.current); };
  }, []);

  const stop = () => {
    clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const cancel = () => {
    clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    // Don't call onRecorded
    mediaRecorderRef.current = null;
    onCancel();
  };

  return (
    <div className="flex items-center gap-3 w-full">
      <button onClick={cancel} className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center">
        <X size={16} className="text-destructive" />
      </button>
      <div className="flex-1 flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
        <span className="text-sm text-foreground font-medium">
          {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
        </span>
      </div>
      <button onClick={stop} className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(var(--hero-gradient-from)), hsl(var(--hero-gradient-to)))" }}>
        <Square size={16} className="text-white" fill="white" />
      </button>
    </div>
  );
};

const Chat = () => {
  const navigate = useNavigate();
  const {
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
    familyKey: hasKey,
    hasMore,
    isLoadingMore,
    loadOlderMessages,
    initProgress,
    isSyncing,
  } = useChat();

  const [newMessage, setNewMessage] = useState("");
  const [showAttachments, setShowAttachments] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const memberNames = Object.values(profiles);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 80,
    overscan: 10,
  });

  // Auto-scroll to bottom on new messages (instant on first load, smooth after)
  const prevCountRef = useRef(0);
  const didInitialScrollRef = useRef(false);
  useEffect(() => {
    if (messages.length === 0) return;
    const el = scrollContainerRef.current;
    if (!el) return;

    if (!didInitialScrollRef.current) {
      // Instant jump on first render so the newest message is visible immediately
      const scrollNow = () => { el.scrollTop = el.scrollHeight; };
      scrollNow();
      requestAnimationFrame(scrollNow);
      setTimeout(scrollNow, 100);
      didInitialScrollRef.current = true;
    } else if (messages.length > prevCountRef.current) {
      setTimeout(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      }, 50);
    }
    prevCountRef.current = messages.length;
  }, [messages.length]);

  const handleSend = () => {
    if (!newMessage.trim() || !isReady) return;
    sendMessage(newMessage);
    setNewMessage("");
    setShowMentions(false);
  };

  const handleReaction = (msgId: string, emoji: string) => {
    addReaction(msgId, emoji);
    setShowEmojiPicker(null);
  };

  const handleInputChange = (value: string) => {
    setNewMessage(value);
    const lastWord = value.split(" ").pop() || "";
    setShowMentions(lastWord.startsWith("@") && lastWord.length >= 1);
  };

  const insertMention = (name: string) => {
    const words = newMessage.split(" ");
    words[words.length - 1] = `@${name} `;
    setNewMessage(words.join(" "));
    setShowMentions(false);
    inputRef.current?.focus();
  };

  // ─── Upload file to chat-media bucket ───
  const uploadChatMedia = useCallback(async (file: File | Blob, ext: string): Promise<string | null> => {
    if (!familyId) return null;
    const id = crypto.randomUUID?.() || Date.now().toString(36);
    const filePath = `${familyId}/${id}.${ext}`;

    const { error } = await supabase.storage
      .from("chat-media")
      .upload(filePath, file, { cacheControl: "3600", upsert: false, contentType: file instanceof File ? file.type : `audio/${ext}` });

    if (error) {
      console.error("Upload error:", error);
      appToast.error("فشل رفع الملف");
      return null;
    }

    const { data: signed } = await supabase.storage.from("chat-media").createSignedUrl(filePath, 60 * 60 * 24 * 7);
    return signed?.signedUrl || null;
  }, [familyId]);

  // ─── Handle image pick ───
  const handleImagePick = useCallback(async (file: File) => {
    const err = await validateFile(file, { maxSizeMB: 5, allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] });
    if (err) { appToast.error(err); return; }

    setShowAttachments(false);
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const localUrl = URL.createObjectURL(file);
    // Show optimistic with local URL, upload in background
    const url = await uploadChatMedia(file, ext);
    if (url) {
      await sendMediaMessage("image", url, { fileName: file.name, fileSize: file.size });
    } else {
      appToast.error("فشل رفع الصورة");
    }
    setUploading(false);
  }, [uploadChatMedia, sendMediaMessage]);

  // ─── Handle voice recorded ───
  const handleVoiceRecorded = useCallback(async (blob: Blob) => {
    setIsRecording(false);
    setUploading(true);
    const ext = blob.type.includes("webm") ? "webm" : "mp4";
    const url = await uploadChatMedia(blob, ext);
    if (url) {
      await sendMediaMessage("voice", url, { fileSize: blob.size });
    } else {
      appToast.error("فشل رفع التسجيل");
    }
    setUploading(false);
  }, [uploadChatMedia, sendMediaMessage]);

  // ─── Handle location share ───
  const handleShareLocation = useCallback(async () => {
    setShowAttachments(false);
    if (!navigator.geolocation) { appToast.error("المتصفح لا يدعم تحديد الموقع"); return; }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        await sendMediaMessage("location", `https://www.google.com/maps?q=${lat},${lng}`, { lat, lng });
      },
      () => appToast.error("تعذر تحديد الموقع، تأكد من تفعيل GPS"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [sendMediaMessage]);

  const pinnedMessages = messages.filter((m) => m.pinned);

  // ─── Render message content based on type ───
  const renderMessageContent = (msg: ChatMessage) => {
    switch (msg.messageType) {
      case "image":
        return (
          <div>
            {msg.mediaUrl && <ImageBubble url={msg.mediaUrl} />}
            {msg.text && msg.text !== "image" && (
              <p className="mt-1 text-sm">{msg.text}</p>
            )}
          </div>
        );
      case "voice":
        return msg.mediaUrl ? <VoicePlayer url={msg.mediaUrl} isMe={msg.isMe} /> : <p>🎙️ رسالة صوتية</p>;
      case "location":
        return msg.mediaMetadata?.lat && msg.mediaMetadata?.lng
          ? <LocationBubble lat={msg.mediaMetadata.lat} lng={msg.mediaMetadata.lng} isMe={msg.isMe} />
          : <p>📍 موقع</p>;
      default:
        return (
          <p>
            {msg.text.split(/(@\S+)/g).map((part, i) =>
              part.startsWith("@") ? (
                <span key={i} className="font-bold text-accent">{part}</span>
              ) : (
                <span key={i}>{part}</span>
              )
            )}
          </p>
        );
    }
  };

  // Don't block the whole UI — show inline encryption banner instead

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      <PageHeader
        title="محادثة العائلة"
        subtitle={`${memberNames.length || 0} أعضاء`}
        onBack={() => navigate("/")}
        actions={[
          {
            icon: <span className="text-lg">👨‍👩‍👧‍👦</span>,
            onClick: () => {},
            style: { background: "hsla(0,0%,100%,0.15)" },
            className: "w-10 h-10 flex items-center justify-center",
          },
        ]}
      />

      {/* Pinned messages bar */}
      {pinnedMessages.length > 0 && (
        <div className="px-4 py-2 border-b border-border bg-accent/10 flex items-center gap-2">
          <Pin size={14} className="text-accent shrink-0" />
          <p className="text-xs text-muted-foreground truncate flex-1">
            <span className="font-semibold text-foreground">
              {pinnedMessages[pinnedMessages.length - 1].senderName}:
            </span>{" "}
            {pinnedMessages[pinnedMessages.length - 1].text}
          </p>
          <span className="text-[10px] text-muted-foreground shrink-0">{pinnedMessages.length} مثبتة</span>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-3 py-4 pb-40"
        style={{ backgroundImage: "radial-gradient(circle at 20% 50%, hsl(var(--muted) / 0.5), transparent 70%)" }}
      >
        {/* Encryption notice — only after key is confirmed */}
        {isReady && (
          <div className="flex justify-center mb-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/60 border border-border/50">
              <Lock size={11} className="text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">
                {hasKey ? "🔐 تشفير طرف لطرف مفعّل" : "التشفير غير مفعّل"}
              </span>
            </div>
          </div>
        )}

        {/* Inline encryption loading banner — only if no cached messages */}
        {!isReady && cachedLoaded && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-6">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center animate-pulse">
              <ShieldCheck size={16} className="text-primary" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">{initProgress.label}</span>
            <div className="w-40">
              <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${initProgress.percent}%` }}
                />
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground">{initProgress.percent}%</span>
          </div>
        )}
        {isReady && cachedLoaded && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center mb-3">
              <Lock size={28} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-bold text-muted-foreground">لا توجد رسائل</p>
            <p className="text-xs text-muted-foreground/60">ابدأ محادثة مشفرة مع عائلتك</p>
          </div>
        )}

        {isReady && hasMore && messages.length > 0 && (
          <div className="flex justify-center py-2">
            <button
              onClick={loadOlderMessages}
              disabled={isLoadingMore}
              className="text-xs text-primary hover:underline disabled:opacity-50"
            >
              {isLoadingMore ? "جاري التحميل..." : "تحميل رسائل أقدم"}
            </button>
          </div>
        )}

        {messages.length > 0 && (
          <div style={{ height: virtualizer.getTotalSize(), width: "100%", position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const msg = messages[virtualRow.index];
              return (
                <div
                  key={msg.id}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className={`flex flex-col ${msg.isMe ? "items-start" : "items-end"} mb-1 group`}>
                    {!msg.isMe && (
                      <span className="text-[11px] font-semibold text-primary px-2 mb-0.5">{msg.senderName}</span>
                    )}
                    <div className="relative max-w-[80%]">
                      <div
                        className={`px-3 py-2 rounded-2xl text-sm leading-relaxed relative ${
                          msg.isMe
                            ? "rounded-bl-md text-primary-foreground"
                            : "rounded-br-md bg-card text-card-foreground border border-border"
                        }`}
                        style={msg.isMe ? { background: "linear-gradient(135deg, hsl(var(--hero-gradient-from)), hsl(var(--hero-gradient-to)))" } : undefined}
                      >
                        {msg.pinned && (
                          <Pin size={10} className={`absolute top-1.5 ${msg.isMe ? "left-1.5 text-white/50" : "left-1.5 text-accent"}`} />
                        )}
                        {renderMessageContent(msg)}
                        <div className={`flex items-center gap-1 mt-0.5 ${msg.isMe ? "justify-start" : "justify-end"}`}>
                          <span className={`text-[10px] ${msg.isMe ? "text-white/50" : "text-muted-foreground"}`}>{msg.time}</span>
                          {msg.isMe && <StatusIcon status={msg.status} />}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className={`absolute top-0 ${msg.isMe ? "-left-20" : "-right-20"} opacity-0 group-hover:opacity-100 transition-opacity flex gap-1`}>
                        {msg.status === "failed" && (
                          <button
                            onClick={() => retryMessage(msg.id)}
                            className="w-7 h-7 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center hover:bg-destructive/20 transition-colors"
                            title="إعادة الإرسال"
                          >
                            <RotateCcw size={14} className="text-destructive" />
                          </button>
                        )}
                        <button
                          onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)}
                          className="w-7 h-7 rounded-full bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors"
                        >
                          <Smile size={14} className="text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => togglePin(msg.id)}
                          className="w-7 h-7 rounded-full bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors"
                        >
                          <Pin size={14} className={msg.pinned ? "text-accent" : "text-muted-foreground"} />
                        </button>
                      </div>

                      {showEmojiPicker === msg.id && (
                        <div className={`absolute ${msg.isMe ? "left-0" : "right-0"} -top-10 flex gap-1 bg-card border border-border rounded-full px-2 py-1 shadow-lg z-10`}>
                          {emojiOptions.map((emoji) => (
                            <button key={emoji} onClick={() => handleReaction(msg.id, emoji)} className="text-lg hover:scale-125 transition-transform">
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className={`flex gap-1 mt-0.5 px-2 ${msg.isMe ? "justify-start" : "justify-end"}`}>
                        {Object.entries(msg.reactions).map(([emoji, count]) => (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(msg.id, emoji)}
                            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-muted border border-border text-xs hover:bg-accent/20 transition-colors"
                          >
                            <span>{emoji}</span>
                            <span className="text-muted-foreground">{count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Mentions dropdown */}
      {showMentions && memberNames.length > 0 && (
        <div className="absolute bottom-36 right-4 left-4 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          {memberNames.map((name) => (
            <button
              key={name}
              onClick={() => insertMention(name)}
              className="w-full text-right px-4 py-2.5 text-sm hover:bg-muted transition-colors border-b border-border last:border-0 flex items-center gap-2"
            >
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                {name[0]}
              </div>
              <span className="text-foreground">{name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-background via-background to-transparent pt-2" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 5rem)" }}>
        <div className="px-3">
          <div className="flex items-center gap-2 p-2 rounded-2xl bg-card border border-border shadow-lg">
            {isRecording ? (
              <VoiceRecorder
                onRecorded={handleVoiceRecorded}
                onCancel={() => setIsRecording(false)}
              />
            ) : (
              <>
                <button
                  onClick={() => setShowAttachments(true)}
                  disabled={uploading}
                  className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 transition-colors hover:bg-muted/80 disabled:opacity-50"
                >
                  {uploading ? (
                    <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  ) : (
                    <Plus size={20} className="text-muted-foreground" />
                  )}
                </button>
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="text"
                  enterKeyHint="send"
                  value={newMessage}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="اكتب رسالة..."
                  className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none px-2 py-2"
                  dir="rtl"
                />
                <button
                  onClick={handleSend}
                  disabled={!newMessage.trim()}
                  className="w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 shrink-0"
                  style={{
                    background: newMessage.trim()
                      ? "linear-gradient(135deg, hsl(var(--hero-gradient-from)), hsl(var(--hero-gradient-to)))"
                      : "hsl(var(--muted))",
                  }}
                >
                  <Send size={18} className={newMessage.trim() ? "text-white" : "text-muted-foreground"} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImagePick(file);
          e.target.value = "";
          setShowAttachments(false);
        }}
      />

      {/* Attachments Bottom Sheet */}
      <Drawer open={showAttachments} onOpenChange={setShowAttachments}>
        <DrawerContent>
          <DrawerHeader className="text-center pb-2">
            <DrawerTitle className="text-base font-bold">إرفاق</DrawerTitle>
          </DrawerHeader>
          <div className="grid grid-cols-3 gap-4 px-6 pb-8 pt-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(142 71% 45%), hsl(142 71% 35%))" }}>
                <Image size={24} className="text-white" />
              </div>
              <span className="text-xs font-medium text-foreground">صورة</span>
            </button>
            <button
              onClick={() => {
                setShowAttachments(false);
                setTimeout(() => setIsRecording(true), 300);
              }}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(262 80% 55%), hsl(262 80% 45%))" }}>
                <Mic size={24} className="text-white" />
              </div>
              <span className="text-xs font-medium text-foreground">تسجيل صوتي</span>
            </button>
            <button
              onClick={handleShareLocation}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(25 95% 53%), hsl(25 95% 43%))" }}>
                <MapPin size={24} className="text-white" />
              </div>
              <span className="text-xs font-medium text-foreground">موقع</span>
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default Chat;
