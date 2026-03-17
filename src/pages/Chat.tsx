import { useState, useRef, useEffect } from "react";
import { ArrowRight, Send, Pin, Lock, Smile, Check, CheckCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/home/BottomNav";

type MessageStatus = "sent" | "delivered" | "read";

interface Message {
  id: string;
  sender: string;
  text: string;
  time: string;
  isMe: boolean;
  pinned?: boolean;
  reactions?: { emoji: string; count: number }[];
  mention?: string;
  status?: MessageStatus;
}

const familyMembers = ["أبي", "أمي", "أحمد", "سارة", "خالد"];

const mockMessages: Message[] = [
  { id: "1", sender: "أبي", text: "السلام عليكم يا أولاد، كيف حالكم اليوم؟", time: "9:30 ص", isMe: false, reactions: [{ emoji: "❤️", count: 3 }] },
  { id: "2", sender: "أنا", text: "وعليكم السلام يا بابا، الحمد لله بخير 😊", time: "9:32 ص", isMe: true, status: "read" },
  { id: "3", sender: "أمي", text: "الغداء جاهز الساعة 2، لا تتأخروا", time: "9:35 ص", isMe: false, pinned: true, reactions: [{ emoji: "👍", count: 4 }] },
  { id: "4", sender: "سارة", text: "@أحمد لا تنسى تجيب الخبز وانت راجع", time: "9:40 ص", isMe: false, mention: "أحمد" },
  { id: "5", sender: "أحمد", text: "إن شاء الله يا سارة، في شي ثاني تبونه؟", time: "9:42 ص", isMe: false },
  { id: "6", sender: "أنا", text: "جيب حليب لو سمحت 🥛", time: "9:43 ص", isMe: true, status: "read" },
  { id: "7", sender: "خالد", text: "وأنا أبي شوكولاتة 😄", time: "9:45 ص", isMe: false, reactions: [{ emoji: "😂", count: 2 }] },
  { id: "8", sender: "أمي", text: "الله يعطيكم العافية، أحبكم كلكم ❤️", time: "9:50 ص", isMe: false, reactions: [{ emoji: "❤️", count: 5 }] },
];

const emojiOptions = ["❤️", "👍", "😂", "😮", "😢", "🤲"];

const StatusIcon = ({ status }: { status: MessageStatus }) => {
  if (status === "sent") {
    return <Check size={14} className="text-white/50" />;
  }
  if (status === "delivered") {
    return <CheckCheck size={14} className="text-white/50" />;
  }
  // read
  return <CheckCheck size={14} className="text-blue-400" />;
};

const Chat = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>(mockMessages);
  const [newMessage, setNewMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!newMessage.trim()) return;
    const msgId = Date.now().toString();
    const msg: Message = {
      id: msgId,
      sender: "أنا",
      text: newMessage,
      time: new Date().toLocaleTimeString("ar-SA", { hour: "numeric", minute: "2-digit", hour12: true }),
      isMe: true,
      status: "sent",
    };
    setMessages((prev) => [...prev, msg]);
    setNewMessage("");
    setShowMentions(false);

    // Simulate delivery after 1s, read after 3s
    setTimeout(() => {
      setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, status: "delivered" as MessageStatus } : m));
    }, 1000);
    setTimeout(() => {
      setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, status: "read" as MessageStatus } : m));
    }, 3000);
  };

  const handleReaction = (msgId: string, emoji: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m;
        const existing = m.reactions?.find((r) => r.emoji === emoji);
        if (existing) {
          return { ...m, reactions: m.reactions!.map((r) => r.emoji === emoji ? { ...r, count: r.count + 1 } : r) };
        }
        return { ...m, reactions: [...(m.reactions || []), { emoji, count: 1 }] };
      })
    );
    setShowEmojiPicker(null);
  };

  const togglePin = (msgId: string) => {
    setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, pinned: !m.pinned } : m));
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

  return (
    <div className="min-h-screen max-w-2xl mx-auto flex flex-col bg-background" dir="rtl">
      {/* Header */}
      <div
        className="sticky top-0 z-40 px-4 pt-12 pb-3"
        style={{
          background: "linear-gradient(135deg, hsl(var(--hero-gradient-from)), hsl(var(--hero-gradient-to)))",
        }}
      >
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => navigate("/")} className="p-1.5 rounded-full" style={{ background: "hsla(0,0%,100%,0.12)" }}>
            <ArrowRight size={20} className="text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">محادثة العائلة</h1>
            <p className="text-xs text-white/70">{familyMembers.length} أعضاء • متصل الآن</p>
          </div>
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{ background: "hsla(0,0%,100%,0.15)" }}>
            👨‍👩‍👧‍👦
          </div>
        </div>
        {/* Encryption label */}
        <div className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg" style={{ background: "hsla(0,0%,100%,0.08)" }}>
          <Lock size={12} className="text-white/60" />
          <span className="text-[11px] text-white/60">التشفير بين جميع الأطراف مضمون</span>
        </div>
      </div>

      {/* Pinned messages bar */}
      {pinnedMessages.length > 0 && (
        <div className="px-4 py-2 border-b border-border bg-accent/10 flex items-center gap-2">
          <Pin size={14} className="text-accent shrink-0" />
          <p className="text-xs text-muted-foreground truncate flex-1">
            <span className="font-semibold text-foreground">{pinnedMessages[pinnedMessages.length - 1].sender}:</span>{" "}
            {pinnedMessages[pinnedMessages.length - 1].text}
          </p>
          <span className="text-[10px] text-muted-foreground shrink-0">{pinnedMessages.length} مثبتة</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 pb-44"
        style={{ backgroundImage: "radial-gradient(circle at 20% 50%, hsl(var(--muted) / 0.5), transparent 70%)" }}
      >
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.isMe ? "items-start" : "items-end"} mb-1 group`}>
            {/* Sender name */}
            {!msg.isMe && (
              <span className="text-[11px] font-semibold text-primary px-2 mb-0.5">{msg.sender}</span>
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
                  {msg.isMe && msg.status && <StatusIcon status={msg.status} />}
                </div>
              </div>

              {/* Action buttons (visible on hover/tap) */}
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
            {msg.reactions && msg.reactions.length > 0 && (
              <div className={`flex gap-1 mt-0.5 px-2 ${msg.isMe ? "justify-start" : "justify-end"}`}>
                {msg.reactions.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => handleReaction(msg.id, r.emoji)}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-muted border border-border text-xs hover:bg-accent/20 transition-colors"
                  >
                    <span>{r.emoji}</span>
                    <span className="text-muted-foreground">{r.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Mentions dropdown */}
      {showMentions && (
        <div className="absolute bottom-36 right-4 left-4 max-w-2xl mx-auto bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          {familyMembers.map((name) => (
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

      <BottomNav />
    </div>
  );
};

export default Chat;
