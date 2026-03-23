import { useState, useRef, useEffect } from "react";
import { Send, Pin, Lock, Smile, Check, CheckCheck, ShieldCheck, Plus, Image, Mic, MapPin, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { useChat } from "@/hooks/useChat";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { toast } from "sonner";

type MessageStatus = "sent" | "delivered" | "read";

const emojiOptions = ["❤️", "👍", "😂", "😮", "😢", "🤲"];

const StatusIcon = ({ status }: { status: string }) => {
  if (status === "sent") return <Check size={14} className="text-white/50" />;
  if (status === "delivered") return <CheckCheck size={14} className="text-white/50" />;
  return <CheckCheck size={14} className="text-blue-400" />;
};

const Chat = () => {
  const navigate = useNavigate();
  const {
    messages,
    isReady,
    sendMessage,
    togglePin,
    addReaction,
    profiles,
    familyKey: hasKey,
  } = useChat();

  const [newMessage, setNewMessage] = useState("");
  const [showAttachments, setShowAttachments] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const memberNames = Object.values(profiles);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!newMessage.trim()) return;
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

  const pinnedMessages = messages.filter((m) => m.pinned);

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto animate-pulse">
            <ShieldCheck size={24} className="text-primary" />
          </div>
          <p className="text-sm text-muted-foreground font-bold">جاري تهيئة التشفير...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-2xl mx-auto flex flex-col bg-background" dir="rtl">
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
        className="flex-1 overflow-y-auto px-3 py-4 space-y-1 pb-44"
        style={{ backgroundImage: "radial-gradient(circle at 20% 50%, hsl(var(--muted) / 0.5), transparent 70%)" }}
      >
        {/* Encryption notice - scrolls with messages like WhatsApp */}
        <div className="flex justify-center mb-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/60 border border-border/50">
            <Lock size={11} className="text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">
              {hasKey ? "🔐 تشفير طرف لطرف مفعّل" : "التشفير غير مفعّل"}
            </span>
          </div>
        </div>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center mb-3">
              <Lock size={28} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-bold text-muted-foreground">لا توجد رسائل</p>
            <p className="text-xs text-muted-foreground/60">ابدأ محادثة مشفرة مع عائلتك</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.isMe ? "items-start" : "items-end"} mb-1 group`}>
            {/* Sender name */}
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
                {/* Highlight mentions */}
                <p>
                  {msg.text.split(/(@\S+)/g).map((part, i) =>
                    part.startsWith("@") ? (
                      <span key={i} className="font-bold text-accent">{part}</span>
                    ) : (
                      <span key={i}>{part}</span>
                    )
                  )}
                </p>
                <div className={`flex items-center gap-1 mt-0.5 ${msg.isMe ? "justify-start" : "justify-end"}`}>
                  <span className={`text-[10px] ${msg.isMe ? "text-white/50" : "text-muted-foreground"}`}>{msg.time}</span>
                  {msg.isMe && <StatusIcon status={msg.status} />}
                </div>
              </div>

              {/* Action buttons */}
              <div className={`absolute top-0 ${msg.isMe ? "-left-16" : "-right-16"} opacity-0 group-hover:opacity-100 transition-opacity flex gap-1`}>
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

              {/* Emoji picker */}
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

            {/* Reactions */}
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
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Mentions dropdown */}
      {showMentions && memberNames.length > 0 && (
        <div className="absolute bottom-36 right-4 left-4 max-w-2xl mx-auto bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
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
      <div className="fixed bottom-24 left-0 right-0 z-40">
        <div className="max-w-2xl mx-auto px-3">
          <div className="flex items-center gap-2 p-2 rounded-2xl bg-card border border-border shadow-lg">
            <input
              ref={inputRef}
              type="text"
              inputMode="text"
              enterKeyHint="send"
              value={newMessage}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="اكتب رسالة... (@ لذكر شخص)"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none px-3 py-2"
              dir="rtl"
            />
            <button
              onClick={handleSend}
              disabled={!newMessage.trim()}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
              style={{
                background: newMessage.trim()
                  ? "linear-gradient(135deg, hsl(var(--hero-gradient-from)), hsl(var(--hero-gradient-to)))"
                  : "hsl(var(--muted))",
              }}
            >
              <Send size={18} className={newMessage.trim() ? "text-white" : "text-muted-foreground"} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
