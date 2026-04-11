import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Search, ArrowRight, ShoppingCart, CheckSquare, Calendar, CreditCard, Plane, FileText, MapPin, Pill, Car, Image, Users } from "lucide-react";
import { db } from "@/lib/db";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import { motion, AnimatePresence } from "framer-motion";

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: string;
  typeLabel: string;
  icon: React.ReactNode;
  path: string;
  color: string;
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; label: string; labelEn: string; color: string; path: string }> = {
  market_item: { icon: <ShoppingCart size={16} />, label: "السوق", labelEn: "Market", color: "hsl(142 70% 45%)", path: "/market" },
  market_list: { icon: <ShoppingCart size={16} />, label: "السوق", labelEn: "Market", color: "hsl(142 70% 45%)", path: "/market" },
  task_item: { icon: <CheckSquare size={16} />, label: "المهام", labelEn: "Tasks", color: "hsl(217 91% 60%)", path: "/tasks" },
  task_list: { icon: <CheckSquare size={16} />, label: "المهام", labelEn: "Tasks", color: "hsl(217 91% 60%)", path: "/tasks" },
  calendar_event: { icon: <Calendar size={16} />, label: "التقويم", labelEn: "Calendar", color: "hsl(280 70% 55%)", path: "/calendar" },
  budget: { icon: <CreditCard size={16} />, label: "الميزانية", labelEn: "Budget", color: "hsl(35 90% 50%)", path: "/budget" },
  debt: { icon: <CreditCard size={16} />, label: "الديون", labelEn: "Debts", color: "hsl(0 70% 55%)", path: "/debts" },
  trip: { icon: <Plane size={16} />, label: "الرحلات", labelEn: "Trips", color: "hsl(190 80% 45%)", path: "/trips" },
  document: { icon: <FileText size={16} />, label: "الوثائق", labelEn: "Documents", color: "hsl(25 85% 55%)", path: "/documents" },
  place: { icon: <MapPin size={16} />, label: "الأماكن", labelEn: "Places", color: "hsl(340 75% 55%)", path: "/places" },
  medication: { icon: <Pill size={16} />, label: "الأدوية", labelEn: "Medications", color: "hsl(160 60% 45%)", path: "/medications" },
  vehicle: { icon: <Car size={16} />, label: "المركبات", labelEn: "Vehicles", color: "hsl(210 50% 50%)", path: "/vehicle" },
  album: { icon: <Image size={16} />, label: "الألبومات", labelEn: "Albums", color: "hsl(300 60% 50%)", path: "/albums" },
  member: { icon: <Users size={16} />, label: "الأعضاء", labelEn: "Members", color: "hsl(250 60% 55%)", path: "/family" },
};

const GlobalSearch = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useAppNavigate();
  const { language, isRTL, dir } = useLanguage();

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const searchLocal = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    const lq = q.toLowerCase();
    const found: SearchResult[] = [];

    const addResult = (id: string, title: string, subtitle: string | undefined, type: string) => {
      const cfg = TYPE_CONFIG[type];
      if (!cfg) return;
      const label = language === "ar" ? cfg.label : cfg.labelEn;
      found.push({ id, title, subtitle, type, typeLabel: label, icon: cfg.icon, path: cfg.path, color: cfg.color });
    };

    try {
      // Debug: log table counts
      const counts = await Promise.all([
        db.market_lists.count(),
        db.market_items.count(),
        db.task_lists.count(),
        db.task_items.count(),
        db.calendar_events.count(),
        db.debts.count(),
      ]);
      console.log("[GlobalSearch] Table counts:", {
        market_lists: counts[0], market_items: counts[1],
        task_lists: counts[2], task_items: counts[3],
        calendar_events: counts[4], debts: counts[5],
      });

      const [
        marketLists, marketItems, taskLists, taskItems,
        events, budgets, debts, trips,
        docLists, docItems, , places,
        medications, vehicles, albums, members, profiles
      ] = await Promise.all([
        db.market_lists.toArray(),
        db.market_items.toArray(),
        db.task_lists.toArray(),
        db.task_items.toArray(),
        db.calendar_events.toArray(),
        db.budgets.toArray(),
        db.debts.toArray(),
        db.trips.toArray(),
        db.document_lists.toArray(),
        db.document_items.toArray(),
        db.place_lists.toArray(),
        db.places.toArray(),
        db.medications.toArray(),
        db.vehicles.toArray(),
        db.albums.toArray(),
        db.family_members.toArray(),
        db.profiles.toArray(),
      ]);

      const profileMap = new Map<string, string>();
      (profiles).forEach(p => { if (p.name) profileMap.set(p.id, p.name); });

      (marketLists).forEach(l => {
        if (l.name?.toLowerCase().includes(lq)) addResult(l.id, l.name, undefined, "market_list");
      });
      (marketItems).forEach(i => {
        if (i.name?.toLowerCase().includes(lq)) {
          const list = (marketLists).find(l => l.id === i.list_id);
          addResult(i.id, i.name, list?.name, "market_item");
        }
      });

      (taskLists).forEach(l => {
        if (l.name?.toLowerCase().includes(lq)) addResult(l.id, l.name, undefined, "task_list");
      });
      (taskItems).forEach(i => {
        if (i.name?.toLowerCase().includes(lq)) {
          const list = (taskLists).find(l => l.id === i.list_id);
          addResult(i.id, i.name, list?.name, "task_item");
        }
      });

      (events).forEach(e => {
        if (e.title?.toLowerCase().includes(lq)) addResult(e.id, e.title, e.date, "calendar_event");
      });

      (budgets).forEach(b => {
        const label = b.label || b.month || "";
        if (label.toLowerCase().includes(lq)) addResult(b.id, label, b.type, "budget");
      });

      (debts).forEach(d => {
        if (d.person_name?.toLowerCase().includes(lq)) {
          const dir = d.direction === "owed_to_me" ? (language === "ar" ? "لي" : "owed to me") : (language === "ar" ? "عليّ" : "I owe");
          addResult(d.id, d.person_name, `${d.amount} - ${dir}`, "debt");
        }
      });

      (trips).forEach(t => {
        if (t.name?.toLowerCase().includes(lq) || t.destination?.toLowerCase().includes(lq))
          addResult(t.id, t.name, t.destination, "trip");
      });

      (docLists).forEach(l => {
        if (l.name?.toLowerCase().includes(lq)) addResult(l.id, l.name, undefined, "document");
      });
      (docItems).forEach(i => {
        if (i.name?.toLowerCase().includes(lq)) {
          const list = (docLists).find(l => l.id === i.list_id);
          addResult(i.id, i.name, list?.name, "document");
        }
      });

      (places).forEach(p => {
        if (p.name?.toLowerCase().includes(lq) || p.address?.toLowerCase().includes(lq))
          addResult(p.id, p.name, p.address || p.category, "place");
      });

      (medications).forEach(m => {
        if (m.name?.toLowerCase().includes(lq)) addResult(m.id, m.name, m.member_name, "medication");
      });

      (vehicles).forEach(v => {
        const label = [v.brand, v.model, v.plate].filter(Boolean).join(" ");
        if (label.toLowerCase().includes(lq)) addResult(v.id, label, v.year?.toString(), "vehicle");
      });

      (albums).forEach(a => {
        if (a.name?.toLowerCase().includes(lq)) addResult(a.id, a.name, undefined, "album");
      });

      (members).forEach(m => {
        const name = profileMap.get(m.user_id) || "";
        if (name.toLowerCase().includes(lq)) addResult(m.id, name, m.role, "member");
      });

    } catch (e) {
      console.error("Search error:", e);
    }

    setResults(found.slice(0, 30));
    setLoading(false);
  }, [language]);

  useEffect(() => {
    const t = setTimeout(() => searchLocal(query), 200);
    return () => clearTimeout(t);
  }, [query, searchLocal]);

  const handleSelect = (result: SearchResult) => {
    onClose();
    navigate(result.path);
  };

  // Group results by typeLabel (category heading)
  const grouped = useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    results.forEach(r => {
      if (!map.has(r.typeLabel)) map.set(r.typeLabel, []);
      map.get(r.typeLabel)!.push(r);
    });
    return map;
  }, [results]);

  if (!open) return null;

  const placeholder = language === "ar" ? "ابحث..." : "Search...";
  const minCharsMsg = language === "ar" ? "اكتب حرفين على الأقل للبحث" : "Type at least 2 characters";
  const noResultsMsg = language === "ar" ? "لا توجد نتائج" : "No results found";
  const tryDiffMsg = language === "ar" ? "جرّب كلمات مختلفة" : "Try different words";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-background"
        dir={dir}
      >
        {/* Search bar — WhatsApp style dark bar */}
        <div className="sticky top-0 z-10 bg-card border-b border-border" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div className="flex items-center gap-2 px-2 py-2">
            <button
              onClick={onClose}
              className="p-2 rounded-full text-muted-foreground hover:bg-muted/60 transition-colors shrink-0"
            >
              <ArrowRight size={22} className={isRTL ? "" : "rotate-180"} />
            </button>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={placeholder}
              className="flex-1 h-10 px-0 bg-transparent text-foreground placeholder:text-muted-foreground/50 text-base focus:outline-none"
              autoComplete="off"
              autoCorrect="off"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="p-2 rounded-full text-muted-foreground hover:bg-muted/60 transition-colors shrink-0"
              >
                <Search size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Results area */}
        <div className="overflow-y-auto" style={{ maxHeight: "calc(100dvh - 56px)" }}>

          {/* Empty — hint */}
          {query.length < 2 && !loading && (
            <div className="flex flex-col items-center justify-center pt-28 text-center px-6">
              <Search size={48} className="text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground/50 text-sm">{minCharsMsg}</p>
            </div>
          )}

          {/* Loading spinner */}
          {loading && query.length >= 2 && (
            <div className="flex items-center justify-center pt-20">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}

          {/* No results */}
          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="flex flex-col items-center justify-center pt-28 text-center px-6">
              <Search size={40} className="text-muted-foreground/20 mb-3" />
              <p className="text-muted-foreground text-sm font-medium">{noResultsMsg}</p>
              <p className="text-muted-foreground/40 text-xs mt-1">{tryDiffMsg}</p>
            </div>
          )}

          {/* Grouped results — WhatsApp style */}
          {!loading && results.length > 0 && (
            <div>
              {Array.from(grouped.entries()).map(([typeLabel, items]) => (
                <div key={typeLabel}>
                  {/* Section header */}
                  <div className="px-4 pt-4 pb-2">
                    <p className="text-sm font-semibold text-primary">{typeLabel}</p>
                  </div>

                  {/* Items */}
                  {items.map((r, i) => (
                    <motion.button
                      key={r.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.015 }}
                      onClick={() => handleSelect(r)}
                      className="w-full flex items-center gap-3 px-4 py-3 active:bg-muted/60 transition-colors"
                    >
                      {/* Avatar circle */}
                      <div
                        className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: r.color + "20", color: r.color }}
                      >
                        {r.icon}
                      </div>

                      {/* Text */}
                      <div className={`flex-1 min-w-0 ${isRTL ? "text-right" : "text-left"}`}>
                        <p className="text-[15px] font-medium text-foreground truncate leading-tight">{r.title}</p>
                        {r.subtitle && (
                          <p className="text-[13px] text-muted-foreground truncate mt-0.5 leading-tight">{r.subtitle}</p>
                        )}
                      </div>
                    </motion.button>
                  ))}

                  {/* Divider */}
                  <div className={`h-px bg-border/50 ${isRTL ? "mr-[4.25rem]" : "ml-[4.25rem]"}`} />
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default GlobalSearch;
