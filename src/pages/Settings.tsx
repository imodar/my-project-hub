import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { ChevronRight, Bell, Moon, Globe, Info, Shield, Trash2, BookOpen, Archive, ShieldAlert, Phone, UserX, Volume2, MapPin, Lock, User, Check, RefreshCw, CheckCircle, AlertTriangle, Loader2, Database, AlertOctagon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { useIslamicMode } from "@/contexts/IslamicModeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole, ROLE_LABELS } from "@/contexts/UserRoleContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useFamilyId } from "@/hooks/useFamilyId";
import { appToast } from "@/lib/toast";
import LanguageSheet from "@/components/LanguageSheet";
import LegalPageSheet from "@/components/LegalPageSheet";

const Settings = () => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const { islamicMode, setIslamicMode } = useIslamicMode();
  const { language, setLanguage, t, dir, isRTL } = useLanguage();
  const { dbRole, isAdmin: isDbAdmin, isLoading: roleLoading } = useUserRole();
  const { familyId } = useFamilyId();
  const [emergencySheetOpen, setEmergencySheetOpen] = useState(false);
  const [contacts, setContacts] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [emergencySound, setEmergencySound] = useState(true);
  const [liveTracking, setLiveTracking] = useState(true);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [notifSheet, setNotifSheet] = useState(false);
  const [langSheet, setLangSheet] = useState(false);
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains("dark"));
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTs, setLastSyncTs] = useState(() => localStorage.getItem("last_sync_ts"));
  const qc = useQueryClient();
  const [privacySheet, setPrivacySheet] = useState(false);
  const [termsSheet, setTermsSheet] = useState(false);

  const isAdmin = isDbAdmin;

  useEffect(() => {
    if (!familyId) return;
    supabase.functions.invoke("settings-api", {
      body: { action: "get-emergency-contacts", family_id: familyId },
    }).then(({ data }) => {
      if (data?.data) setContacts(data.data);
    });
  }, [familyId]);

  useEffect(() => {
    if (!familyId || !user) return;
    supabase.functions.invoke("family-management", {
      body: { action: "get-members", family_id: familyId },
    }).then(({ data }) => {
      if (!data?.data) return;
      const membersList = (data.data as any[])
        .filter((m: any) => m.user_id !== user!.id)
        .map((m: any) => ({
          id: m.user_id,
          name: m.profiles?.name || t.emergency.noName,
        }));
      setMembers(membersList);
    });
  }, [familyId, user, t]);

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    appToast.success(next ? t.settings.darkEnabled : t.settings.lightEnabled);
  };

  const settingsGroups = [
    {
      title: t.settings.general,
      items: [
        { icon: Bell, label: t.settings.notifications, desc: t.settings.notificationsDesc, onClick: () => setNotifSheet(true) },
        { icon: Moon, label: t.settings.appearance, desc: darkMode ? t.settings.darkMode : t.settings.lightMode, onClick: toggleDark },
        { icon: Globe, label: t.settings.language, desc: language === "ar" ? t.settings.arabic : t.settings.english, onClick: () => setLangSheet(true) },
      ],
    },
    {
      title: t.settings.aboutApp,
      items: [
        { icon: Info, label: t.settings.about, desc: t.settings.version },
        { icon: Shield, label: t.settings.privacy, desc: "", onClick: () => setPrivacySheet(true) },
        { icon: Shield, label: t.settings.terms, desc: "", onClick: () => setTermsSheet(true) },
      ],
    },
    {
      title: t.settings.other,
      items: [
        { icon: Archive, label: t.settings.trash, desc: t.settings.trashDesc, onClick: () => navigate("/trash") },
        { icon: Trash2, label: t.settings.clearData, desc: t.settings.clearDataDesc, danger: true },
        { icon: LogOut, label: t.settings.logout, desc: t.settings.logoutDesc, danger: true, onClick: async () => { await signOut(); navigate("/auth", { replace: true }); } },
      ],
    },
  ];

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      qc.invalidateQueries();
      await qc.refetchQueries({ type: "active" });
      const now = new Date().toISOString();
      localStorage.setItem("last_sync_ts", now);
      setLastSyncTs(now);
      appToast.success(t.sync.syncSuccess);
    } catch {
      appToast.error(t.sync.unexpectedError);
    } finally {
      setIsSyncing(false);
    }
  };

  const getTimeSince = (ts: string | null) => {
    if (!ts) return t.sync.noSyncYet;
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return language === "ar" ? "الآن" : "Just now";
    if (mins < 60) return language === "ar" ? `منذ ${mins} دقيقة` : `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return language === "ar" ? `منذ ${hours} ساعة` : `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return language === "ar" ? `منذ ${days} يوم` : `${days}d ago`;
  };

  const isRecent = lastSyncTs ? (Date.now() - new Date(lastSyncTs).getTime()) < 24 * 60 * 60 * 1000 : false;

  const handleAddContact = async () => {
    if (!newContactName.trim() || !newContactPhone.trim() || !familyId || !user) return;
    const { data, error } = await supabase.functions.invoke("settings-api", {
      body: { action: "add-emergency-contact", family_id: familyId, name: newContactName.trim(), phone: newContactPhone.trim() },
    });
    if (error || data?.error) {
      appToast.error(t.emergency.addContactFailed);
    } else if (data?.data) {
      setContacts(prev => [...prev, { id: data.data.id, name: data.data.name, phone: data.data.phone }]);
      setNewContactName("");
      setNewContactPhone("");
      setAddContactOpen(false);
      appToast.success(t.emergency.contactAdded);
    }
  };

  const handleRemoveContact = async (id: string) => {
    const { data, error } = await supabase.functions.invoke("settings-api", {
      body: { action: "delete-emergency-contact", id },
    });
    if (!error && !data?.error) {
      setContacts(prev => prev.filter(c => c.id !== id));
    }
  };





  return (
    <div
      className="min-h-screen max-w-2xl mx-auto flex flex-col pb-28 bg-background"
      dir={dir}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1 px-3 py-2 rounded-2xl text-sm font-semibold text-foreground bg-muted"
        >
          {t.back}
          <ChevronRight size={18} className={isRTL ? "" : "rotate-180"} />
        </button>
        <h1 className="text-lg font-bold text-foreground">{t.settings.title}</h1>
        <div />
      </div>

      {/* Settings */}
      <div className="flex-1 px-4 pb-8 space-y-6">

        {/* Emergency Settings - Admin Only */}
        {isAdmin && (
          <div>
            <h2 className="text-xs font-semibold mb-2 px-1" style={{ color: "hsl(0, 72%, 51%)" }}>
              🚨 {t.emergency.settings}
            </h2>
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: "linear-gradient(135deg, hsl(0, 84%, 97%), hsl(0, 60%, 95%))",
                boxShadow: "0 2px 16px hsla(0, 72%, 51%, 0.12)",
                border: "1px solid hsla(0, 72%, 51%, 0.15)",
              }}
            >
              <button
                onClick={() => setEmergencySheetOpen(true)}
                className={`w-full flex items-center gap-3 px-4 py-4 ${isRTL ? "text-right" : "text-left"} transition-colors active:bg-red-100/50`}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: "linear-gradient(135deg, hsl(0, 72%, 51%), hsl(0, 84%, 60%))",
                    boxShadow: "0 3px 10px hsla(0, 72%, 51%, 0.3)",
                  }}
                >
                  <ShieldAlert size={20} className="text-white" />
                </div>
                <div className={`flex-1 ${isRTL ? "text-right" : "text-left"}`}>
                  <p className="text-sm font-bold" style={{ color: "hsl(0, 72%, 40%)" }}>
                    {t.emergency.settingsTitle}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "hsl(0, 40%, 55%)" }}>
                    {t.emergency.settingsDesc}
                  </p>
                </div>
                <ChevronRight size={16} style={{ color: "hsl(0, 50%, 60%)" }} className={isRTL ? "rotate-180" : ""} />
              </button>

              <div className="px-4 py-2.5 flex items-center gap-2 border-t" style={{ borderColor: "hsla(0, 72%, 51%, 0.1)" }}>
                <Lock size={12} style={{ color: "hsl(0, 50%, 55%)" }} />
                <p className="text-[11px]" style={{ color: "hsl(0, 40%, 55%)" }}>
                  {t.emergency.adminOnly}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Islamic Mode Toggle */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground mb-2 px-1">{t.settings.modeSection}</h2>
          <div
            className="rounded-2xl overflow-hidden bg-card shadow-sm"
          >
            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3.5 cursor-pointer"
              onClick={() => setIslamicMode(!islamicMode)}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "hsl(145, 40%, 42%, 0.1)" }}
              >
                <BookOpen size={18} style={{ color: "hsl(145, 40%, 42%)" }} />
              </div>
              <div className={`flex-1 ${isRTL ? "text-right" : "text-left"}`}>
                <p className="text-sm font-semibold text-foreground">{t.settings.islamicMode}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {islamicMode ? t.settings.islamicModeOnDesc : t.settings.islamicModeOffDesc}
                </p>
              </div>
              <div
                className={`relative h-6 w-11 rounded-full transition-colors ${islamicMode ? "bg-primary" : "bg-input"}`}
                style={{ direction: "ltr" }}
                aria-hidden="true"
              >
                <div
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-background shadow-lg transition-transform ${islamicMode ? "translate-x-5" : "translate-x-0.5"}`}
                />
              </div>
            </button>
          </div>
        </div>

        {/* Role Display */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground mb-2 px-1">{t.settings.familyRole}</h2>
          <div
            className="rounded-2xl overflow-hidden p-4 bg-card shadow-sm"
          >
            {roleLoading ? (
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <Skeleton className="h-5 w-24" />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "hsl(var(--primary) / 0.1)" }}
                >
                  <User size={20} className="text-primary" />
                </div>
                <div className={`flex-1 ${isRTL ? "text-right" : "text-left"}`}>
                  <p className="text-sm font-bold text-foreground">
                    {dbRole ? ROLE_LABELS[dbRole] || dbRole : t.settings.roleUnset}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {t.settings.roleSetByAdmin}
                  </p>
                </div>
                <span
                  className="text-[10px] font-semibold px-2 py-1 rounded-full"
                  style={{ background: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))" }}
                >
                  {t.fromDatabase}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Data & Backup */}
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground mb-2 px-1">
            {t.sync.backupTitle}
          </h2>
          <div className="rounded-2xl overflow-hidden bg-card shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "hsl(var(--primary) / 0.1)" }}
                >
                  <Database size={18} className="text-primary" />
                </div>
                <div className={isRTL ? "text-right" : "text-left"}>
                  <p className="text-sm font-semibold text-foreground">{t.sync.lastBackup}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {getTimeSince(lastSyncTs)}
                  </p>
                </div>
              </div>
              {lastSyncTs ? (
                isRecent ? (
                  <CheckCircle size={20} className="text-green-500 shrink-0" />
                ) : (
                  <AlertTriangle size={20} className="text-yellow-500 shrink-0" />
                )
              ) : null}
            </div>

            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors active:scale-[0.98] disabled:opacity-50"
              style={{ background: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))" }}
            >
              {isSyncing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {t.sync.syncing}
                </>
              ) : (
                <>
                  <RefreshCw size={16} />
                  {t.sync.syncNow}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Other Settings Groups */}
        {settingsGroups.map((group) => (
          <div key={group.title}>
            <h2 className="text-xs font-semibold text-muted-foreground mb-2 px-1">
              {group.title}
            </h2>
            <div
              className="rounded-2xl overflow-hidden divide-y divide-border bg-card shadow-sm"
            >
              {group.items.map((item) => (
                <button
                  key={item.label}
                  onClick={(item as any).onClick}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 ${isRTL ? "text-right" : "text-left"} transition-colors active:bg-muted/50`}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: (item as any).danger
                        ? "hsl(0, 84%, 60%, 0.1)"
                        : "hsl(var(--primary) / 0.1)",
                    }}
                  >
                    <item.icon
                      size={18}
                      className={(item as any).danger ? "text-destructive" : "text-primary"}
                    />
                  </div>
                  <div className={`flex-1 ${isRTL ? "text-right" : "text-left"}`}>
                    <p className={`text-sm font-semibold ${(item as any).danger ? "text-destructive" : "text-foreground"}`}>
                      {item.label}
                    </p>
                    {item.desc && (
                      <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                    )}
                  </div>
                  <ChevronRight size={16} className={`text-muted-foreground ${isRTL ? "rotate-180" : ""}`} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Emergency Settings Sheet */}
      <Sheet open={emergencySheetOpen} onOpenChange={setEmergencySheetOpen}>
        <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl p-0 border-none" style={{ direction: dir }}>
          <div className="h-full flex flex-col overflow-hidden">
            <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, hsl(0, 72%, 51%), hsl(0, 84%, 60%))",
                  }}
                >
                  <ShieldAlert size={20} className="text-white" />
                </div>
                <div>
                  <SheetTitle className={`text-foreground text-lg font-bold ${isRTL ? "text-right" : "text-left"}`}>{t.emergency.settings}</SheetTitle>
                  <p className={`text-xs text-muted-foreground ${isRTL ? "text-right" : "text-left"}`}>{t.emergency.customize}</p>
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              {/* Emergency Contacts */}
              <div>
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <Phone size={16} style={{ color: "hsl(0, 72%, 51%)" }} />
                  {t.emergency.externalContacts}
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  {t.emergency.externalContactsDesc}
                </p>
                <div className="space-y-2">
                  {contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl"
                      style={{ background: "hsla(0, 72%, 51%, 0.05)", border: "1px solid hsla(0, 72%, 51%, 0.1)" }}
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "hsla(0, 72%, 51%, 0.1)" }}>
                        <Phone size={14} style={{ color: "hsl(0, 72%, 51%)" }} />
                      </div>
                      <div className={`flex-1 ${isRTL ? "text-right" : "text-left"}`}>
                        <p className="text-sm font-semibold text-foreground">{contact.name}</p>
                        <p className="text-xs text-muted-foreground" style={{ direction: "ltr", textAlign: isRTL ? "right" : "left" }}>{contact.phone}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveContact(contact.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors active:scale-95"
                        style={{ background: "hsla(0, 72%, 51%, 0.1)" }}
                      >
                        <Trash2 size={14} style={{ color: "hsl(0, 72%, 51%)" }} />
                      </button>
                    </div>
                  ))}
                </div>

                {addContactOpen ? (
                  <div className="mt-3 p-4 rounded-xl space-y-3" style={{ background: "hsla(0,0%,0%,0.03)", border: "1px dashed hsla(0,0%,0%,0.1)" }}>
                    <input
                      value={newContactName}
                      onChange={e => setNewContactName(e.target.value)}
                      placeholder={t.name}
                      className="w-full px-3 py-2.5 rounded-xl text-sm bg-background border border-border focus:outline-none focus:ring-2 focus:ring-red-300"
                    />
                    <input
                      value={newContactPhone}
                      onChange={e => setNewContactPhone(e.target.value)}
                      placeholder={t.phone}
                      className="w-full px-3 py-2.5 rounded-xl text-sm bg-background border border-border focus:outline-none focus:ring-2 focus:ring-red-300"
                      style={{ direction: "ltr" }}
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={handleAddContact}
                        className="flex-1 rounded-xl h-10 text-sm font-bold"
                        style={{ background: "hsl(0, 72%, 51%)", color: "white" }}
                      >
                        {t.add}
                      </Button>
                      <Button
                        onClick={() => { setAddContactOpen(false); setNewContactName(""); setNewContactPhone(""); }}
                        variant="outline"
                        className="flex-1 rounded-xl h-10 text-sm"
                      >
                        {t.cancel}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddContactOpen(true)}
                    className="w-full mt-3 py-3 rounded-xl text-sm font-semibold transition-colors active:scale-[0.98]"
                    style={{ border: "2px dashed hsla(0, 72%, 51%, 0.25)", color: "hsl(0, 72%, 51%)" }}
                  >
                    {t.emergency.addContact}
                  </button>
                )}
              </div>

              {/* Toggle Settings */}
              <div>
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <Volume2 size={16} style={{ color: "hsl(0, 72%, 51%)" }} />
                  {t.emergency.alertSettings}
                </h3>
                <div className="space-y-1 rounded-xl overflow-hidden" style={{ background: "hsla(0,0%,0%,0.02)", border: "1px solid hsla(0,0%,0%,0.06)" }}>
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <Volume2 size={16} style={{ color: "hsl(0, 72%, 51%)" }} />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{t.emergency.distinctSound}</p>
                        <p className="text-xs text-muted-foreground">{t.emergency.distinctSoundDesc}</p>
                      </div>
                    </div>
                    <Switch checked={emergencySound} onCheckedChange={setEmergencySound} />
                  </div>
                  <div className="h-px bg-border mx-4" />
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <MapPin size={16} style={{ color: "hsl(0, 72%, 51%)" }} />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{t.emergency.liveTracking}</p>
                        <p className="text-xs text-muted-foreground">{t.emergency.liveTrackingDesc}</p>
                      </div>
                    </div>
                    <Switch checked={liveTracking} onCheckedChange={setLiveTracking} />
                  </div>
                </div>
              </div>

              {/* Member SOS Permissions */}
              <div>
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <UserX size={16} style={{ color: "hsl(0, 72%, 51%)" }} />
                  {t.emergency.sosPermissions}
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  {t.emergency.sosPermissionsDesc}
                </p>
                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between px-4 py-3 rounded-xl"
                      style={{ background: "hsla(0,0%,0%,0.02)", border: "1px solid hsla(0,0%,0%,0.06)" }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary/10">
                          <span className="text-xs font-bold text-primary">{member.name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{member.name}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Notifications Sheet */}
      <Sheet open={notifSheet} onOpenChange={setNotifSheet}>
        <SheetContent side="bottom" className="h-[60vh] rounded-t-3xl p-0 border-none" style={{ direction: dir }}>
          <div className="h-full flex flex-col">
            <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
              <SheetTitle className={`text-foreground text-lg font-bold ${isRTL ? "text-right" : "text-left"}`}>{t.settings.notifSettings}</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <p className="text-sm text-muted-foreground text-center py-8">
                {t.settings.notifAutoMsg}
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <LanguageSheet open={langSheet} onOpenChange={setLangSheet} />
      <LegalPageSheet open={privacySheet} onOpenChange={setPrivacySheet} slug="privacy-policy" />
      <LegalPageSheet open={termsSheet} onOpenChange={setTermsSheet} slug="terms-of-service" />
    </div>
  );
};

export default Settings;
