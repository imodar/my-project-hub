import React, { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  ShieldAlert, X, Phone, MapPin, Plus, Trash2,
  Radio, PhoneCall, MessageSquare, Check, AlertTriangle
} from "lucide-react";
import { appToast } from "@/lib/toast";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "@/hooks/useFamilyId";
import { supabase } from "@/integrations/supabase/client";

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relation?: string;
}

type SOSPhase = "idle" | "holding" | "countdown" | "active";

const SOSButton = React.forwardRef<HTMLDivElement>((_props, ref) => {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const [familyMembers, setFamilyMembers] = useState<{ id: string; name: string }[]>([]);
  const [phase, setPhase] = useState<SOSPhase>("idle");
  const [holdProgress, setHoldProgress] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [settingsDrawer, setSettingsDrawer] = useState(false);
  const [cancelDrawer, setCancelDrawer] = useState(false);
  const [addContactDrawer, setAddContactDrawer] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [notifiedCount, setNotifiedCount] = useState(0);

  // Fetch family members via Edge Function
  useEffect(() => {
    if (!familyId) return;
    supabase.functions.invoke("family-management", {
      body: { action: "get-members", family_id: familyId },
    }).then(({ data, error }) => {
      if (!error && data?.data) {
        setFamilyMembers(
          data.data.map((m: { user_id: string; name?: string }) => ({ id: m.user_id, name: m.name || "بدون اسم" }))
        );
      }
    });
  }, [familyId]);

  // Emergency contacts from DB via settings-api
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRelation, setNewRelation] = useState("");

  useEffect(() => {
    if (!familyId) return;
    supabase.functions.invoke("settings-api", {
      body: { action: "get-emergency-contacts", family_id: familyId },
    }).then(({ data, error }) => {
      if (!error && data?.data) {
        setContacts(data.data);
      }
    });
  }, [familyId]);

  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (holdTimer.current) clearInterval(holdTimer.current);
      if (countdownTimer.current) clearInterval(countdownTimer.current);
      if (activeTimer.current) clearInterval(activeTimer.current);
      if (tapTimer.current) clearTimeout(tapTimer.current);
    };
  }, []);

  // Hold-to-activate (3 seconds)
  const startHold = useCallback(() => {
    if (phase === "active") return;
    setPhase("holding");
    setHoldProgress(0);
    let progress = 0;
    holdTimer.current = setInterval(() => {
      progress += 100 / 30;
      setHoldProgress(Math.min(progress, 100));
      if (progress >= 100) {
        if (holdTimer.current) clearInterval(holdTimer.current);
        startCountdown();
      }
    }, 100);
  }, [phase]);

  const cancelHold = useCallback(() => {
    if (phase === "holding") {
      if (holdTimer.current) clearInterval(holdTimer.current);
      setPhase("idle");
      setHoldProgress(0);
    }
  }, [phase]);

  // Triple-tap activation
  const handleTap = useCallback(() => {
    if (phase === "active") {
      setCancelDrawer(true);
      return;
    }
    if (phase !== "idle") return;

    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);

    if (tapCount.current >= 3) {
      tapCount.current = 0;
      startCountdown();
    } else {
      tapTimer.current = setTimeout(() => {
        tapCount.current = 0;
      }, 600);
    }
  }, [phase]);

  // Countdown phase
  const startCountdown = useCallback(() => {
    setPhase("countdown");
    setCountdown(3);
    let count = 3;
    countdownTimer.current = setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count <= 0) {
        if (countdownTimer.current) clearInterval(countdownTimer.current);
        activateSOS();
      }
    }, 1000);
  }, []);

  // Listen for nav bar SOS trigger
  useEffect(() => {
    const handler = () => {
      if (phase === "active") {
        setCancelDrawer(true);
      } else if (phase === "idle") {
        startCountdown();
      }
    };
    window.addEventListener("trigger-sos", handler);
    return () => window.removeEventListener("trigger-sos", handler);
  }, [phase, startCountdown]);

  const cancelCountdown = useCallback(() => {
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    setPhase("idle");
    setCountdown(3);
    setHoldProgress(0);
    appToast.info("تم إلغاء التنبيه");
  }, []);

  // Active SOS — sends real notification to family
  const activateSOS = useCallback(async () => {
    setPhase("active");
    setActiveSeconds(0);

    // Alert sound
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playBeep = (freq: number, start: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = freq;
        gain.gain.value = 0.3;
        osc.start(audioCtx.currentTime + start);
        osc.stop(audioCtx.currentTime + start + 0.2);
      };
      playBeep(880, 0);
      playBeep(1100, 0.3);
      playBeep(880, 0.6);
    } catch {}

    // Send real SOS alert via notifications-api
    if (familyId) {
      try {
        const { data, error } = await supabase.functions.invoke("notifications-api", {
          body: { action: "send-sos-alert", family_id: familyId },
        });
        if (!error && data?.data?.notified) {
          setNotifiedCount(data.data.notified);
          appToast.error(`🚨 تم تفعيل تنبيه الطوارئ — تم إشعار ${data.data.notified} من أفراد العائلة`);
        } else {
          appToast.error("🚨 تم تفعيل تنبيه الطوارئ");
        }
      } catch {
        appToast.error("🚨 تم تفعيل التنبيه — لكن فشل إرسال الإشعارات");
      }
    }

    activeTimer.current = setInterval(() => {
      setActiveSeconds((s) => s + 1);
    }, 1000);
  }, [familyId]);

  const handleCancelSOS = useCallback(async () => {
    if (activeTimer.current) clearInterval(activeTimer.current);
    setPhase("idle");
    setActiveSeconds(0);
    setHoldProgress(0);
    setCancelDrawer(false);
    const reason = cancelReason.trim() || "بخير";

    // Send cancel notification
    if (familyId) {
      try {
        await supabase.functions.invoke("notifications-api", {
          body: { action: "cancel-sos-alert", family_id: familyId },
        });
      } catch {}
    }

    appToast.success(`تم إلغاء التنبيه — "${reason}"`);
    setCancelReason("");
  }, [cancelReason, familyId]);

  const handleAddContact = async () => {
    if (!newName.trim() || !newPhone.trim() || !familyId) return;
    const { error } = await supabase.functions.invoke("settings-api", {
      body: { action: "add-emergency-contact", family_id: familyId, name: newName.trim(), phone: newPhone.trim() },
    });
    if (!error) {
      // Refresh contacts from DB
      const { data } = await supabase.functions.invoke("settings-api", {
        body: { action: "get-emergency-contacts", family_id: familyId },
      });
      if (data?.data) setContacts(data.data);
      setNewName("");
      setNewPhone("");
      setNewRelation("");
      setAddContactDrawer(false);
      appToast.success("تم إضافة جهة الاتصال");
    } else {
      appToast.error("فشل إضافة جهة الاتصال");
    }
  };

  const removeContact = async (id: string) => {
    if (!familyId) return;
    const { error } = await supabase.functions.invoke("settings-api", {
      body: { action: "delete-emergency-contact", id },
    });
    if (!error) {
      setContacts((prev) => prev.filter((c) => c.id !== id));
      appToast.success("تم حذف جهة الاتصال");
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div ref={ref}>
      {/* Countdown overlay */}
      {phase === "countdown" && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/90 flex flex-col items-center justify-center" dir="rtl">
          <div className="relative">
            <div className="w-40 h-40 rounded-full border-4 border-red-500 flex items-center justify-center animate-pulse">
              <span className="text-7xl font-extrabold text-red-500 tabular-nums">{countdown}</span>
            </div>
          </div>
          <p className="text-white/80 text-base font-bold mt-8">جاري إرسال التنبيه...</p>
          <p className="text-white/50 text-sm mt-2">سيتم إشعار جميع أفراد العائلة</p>
          <Button
            onClick={cancelCountdown}
            className="mt-10 rounded-2xl px-8 h-12 text-base font-bold hover:bg-white/20 active:scale-95"
            style={{ background: "hsla(0,0%,100%,0.15)", color: "white", border: "1px solid hsla(0,0%,100%,0.3)" }}
          >
            <X size={18} /> إلغاء
          </Button>
        </div>,
        document.body
      )}

      {/* Active SOS overlay */}
      {phase === "active" && createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col" dir="rtl">
          <div className="absolute inset-0 bg-red-600 animate-pulse" style={{ animationDuration: "2s" }} />
          <div className="relative flex-1 flex flex-col items-center justify-center px-6">
            <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center mb-6">
              <Radio size={40} className="text-white animate-ping" style={{ animationDuration: "1.5s" }} />
            </div>
            <h2 className="text-2xl font-extrabold text-white">تنبيه طوارئ نشط</h2>
            <p className="text-white/80 text-sm mt-2 text-center">تم إشعار جميع أفراد العائلة بموقعك</p>

            <div className="mt-6 bg-black/30 rounded-2xl px-6 py-3">
              <span className="text-white font-mono text-2xl tabular-nums">{formatTime(activeSeconds)}</span>
            </div>

            <div className="mt-8 bg-black/20 rounded-2xl p-4 w-full max-w-sm space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <MapPin size={16} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-white/60">آخر تحديث للموقع</p>
                  <p className="text-sm text-white font-bold">قبل {activeSeconds < 30 ? activeSeconds : activeSeconds % 30} ثانية</p>
                </div>
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <MessageSquare size={16} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-white/60">جهات طوارئ خارجية</p>
                  <p className="text-sm text-white font-bold">{contacts.length} جهة مسجلة</p>
                </div>
                <Check size={16} className="text-green-400" />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <PhoneCall size={16} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-white/60">إشعارات العائلة</p>
                  <p className="text-sm text-white font-bold">{notifiedCount || familyMembers.length} أفراد تم إشعارهم</p>
                </div>
                <Check size={16} className="text-green-400" />
              </div>
            </div>

            <Button
              onClick={() => setCancelDrawer(true)}
              className="mt-8 rounded-2xl px-8 h-14 text-base font-bold bg-white text-red-600 hover:bg-white/90 shadow-xl"
            >
              إلغاء التنبيه
            </Button>
          </div>

          <Drawer open={cancelDrawer} onOpenChange={setCancelDrawer}>
            <DrawerContent className="z-[10000]">
              <DrawerHeader><DrawerTitle>إلغاء تنبيه الطوارئ</DrawerTitle></DrawerHeader>
              <div className="px-5 pb-8 space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  سيتم إبلاغ جميع أفراد العائلة بأنك بخير
                </p>
                <div className="flex gap-2">
                  {["بخير", "كان خطأ"].map((reason) => (
                    <button
                      key={reason}
                      onClick={() => setCancelReason(reason)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                        cancelReason === reason
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
                <Textarea
                  placeholder="أو اكتب سبباً آخر..."
                  value={!["بخير", "كان خطأ"].includes(cancelReason) ? cancelReason : ""}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="min-h-[60px]"
                />
                <Button
                  className="w-full rounded-xl h-12"
                  onClick={handleCancelSOS}
                >
                  <Check size={18} /> تأكيد الإلغاء
                </Button>
              </div>
            </DrawerContent>
          </Drawer>
        </div>,
        document.body
      )}

      {/* Settings Drawer */}
      <Drawer open={settingsDrawer} onOpenChange={setSettingsDrawer}>
        <DrawerContent>
          <DrawerHeader><DrawerTitle>إعدادات الطوارئ</DrawerTitle></DrawerHeader>
          <div className="px-5 pb-8 space-y-5 max-h-[70vh] overflow-y-auto">
            <div className="bg-red-50 dark:bg-red-950/20 rounded-2xl p-4 space-y-2">
              <h4 className="text-sm font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                <AlertTriangle size={16} /> كيفية التفعيل
              </h4>
              <ul className="text-xs text-red-600/80 dark:text-red-400/70 space-y-1.5 pr-4">
                <li>• الضغط المطوّل 3 ثوانٍ على زر SOS</li>
                <li>• أو الضغط 3 مرات متتالية سريعة</li>
                <li>• يظهر عداد تنازلي 3 ثوانٍ قبل الإرسال مع إمكانية الإلغاء</li>
              </ul>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-foreground">أرقام الطوارئ الخارجية</h4>
                <button onClick={() => setAddContactDrawer(true)} className="p-1.5 rounded-lg bg-primary/10">
                  <Plus size={14} className="text-primary" />
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">
                أشخاص خارج العائلة سيتلقون رسالة SMS عند التفعيل
              </p>
              <div className="space-y-2">
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center gap-3 bg-card rounded-xl border border-border/50 p-3"
                  >
                    <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <Phone size={16} className="text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">{contact.name}</p>
                      <p className="text-[11px] text-muted-foreground" dir="ltr">{contact.phone}</p>
                    </div>
                    {contact.relation && (
                      <Badge variant="secondary" className="text-[10px] shrink-0">{contact.relation}</Badge>
                    )}
                    <button onClick={() => removeContact(contact.id)} className="p-1 rounded-lg hover:bg-destructive/10">
                      <Trash2 size={14} className="text-destructive" />
                    </button>
                  </div>
                ))}
                {contacts.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-4">
                    لم تُضف أرقام طوارئ خارجية بعد
                  </p>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-foreground mb-3">أفراد العائلة (إشعار تلقائي)</h4>
              <div className="space-y-2">
                {familyMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 bg-card rounded-xl border border-border/50 p-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">{member.name[0]}</span>
                    </div>
                    <span className="text-sm font-medium text-foreground flex-1">{member.name}</span>
                    <Check size={16} className="text-primary" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Add Contact Drawer */}
      <Drawer open={addContactDrawer} onOpenChange={setAddContactDrawer}>
        <DrawerContent>
          <DrawerHeader><DrawerTitle>إضافة رقم طوارئ</DrawerTitle></DrawerHeader>
          <div className="px-5 pb-8 space-y-4">
            <Input placeholder="الاسم" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Input placeholder="رقم الهاتف" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} type="tel" dir="ltr" />
            <Input placeholder="القرابة (جد، عم، صديق...)" value={newRelation} onChange={(e) => setNewRelation(e.target.value)} />
            <Button className="w-full rounded-xl" onClick={handleAddContact}>إضافة</Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
});

SOSButton.displayName = "SOSButton";

export default SOSButton;
