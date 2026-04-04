import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Search, X, ShoppingCart, CheckSquare, Calendar, CreditCard, Plane, FileText, MapPin, Pill, Car, MessageCircle, Image, Users } from "lucide-react";
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

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string; path: string }> = {
  market_item: { icon: <ShoppingCart size={18} />, label: "سوق", color: "hsl(142 70% 45%)", path: "/market" },
  market_list: { icon: <ShoppingCart size={18} />, label: "قائمة سوق", color: "hsl(142 70% 45%)", path: "/market" },
  task_item: { icon: <CheckSquare size={18} />, label: "مهمة", color: "hsl(217 91% 60%)", path: "/tasks" },
  task_list: { icon: <CheckSquare size={18} />, label: "قائمة مهام", color: "hsl(217 91% 60%)", path: "/tasks" },
  calendar_event: { icon: <Calendar size={18} />, label: "مناسبة", color: "hsl(280 70% 55%)", path: "/calendar" },
  budget: { icon: <CreditCard size={18} />, label: "ميزانية", color: "hsl(35 90% 50%)", path: "/budget" },
  debt: { icon: <CreditCard size={18} />, label: "دين", color: "hsl(0 70% 55%)", path: "/debts" },
  trip: { icon: <Plane size={18} />, label: "رحلة", color: "hsl(190 80% 45%)", path: "/trips" },
  document: { icon: <FileText size={18} />, label: "مستند", color: "hsl(25 85% 55%)", path: "/documents" },
  place: { icon: <MapPin size={18} />, label: "مكان", color: "hsl(340 75% 55%)", path: "/places" },
  medication: { icon: <Pill size={18} />, label: "دواء", color: "hsl(160 60% 45%)", path: "/medications" },
  vehicle: { icon: <Car size={18} />, label: "مركبة", color: "hsl(210 50% 50%)", path: "/vehicle" },
  album: { icon: <Image size={18} />, label: "ألبوم", color: "hsl(300 60% 50%)", path: "/albums" },
  member: { icon: <Users size={18} />, label: "عضو", color: "hsl(250 60% 55%)", path: "/family" },
};

const GlobalSearch = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useAppNavigate();

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
      found.push({ id, title, subtitle, type, typeLabel: cfg.label, icon: cfg.icon, path: cfg.path, color: cfg.color });
    };

    try {
      const [
        marketLists, marketItems, taskLists, taskItems,
        events, budgets, debts, trips,
        docLists, docItems, placeLists, places,
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

      // Build profile name map
      const profileMap = new Map<string, string>();
      (profiles as any[]).forEach(p => { if (p.name) profileMap.set(p.id, p.name); });

      // Market lists & items
      (marketLists as any[]).forEach(l => {
        if (l.name?.toLowerCase().includes(lq)) addResult(l.id, l.name, undefined, "market_list");
      });
      (marketItems as any[]).forEach(i => {
        if (i.name?.toLowerCase().includes(lq)) {
          const list = (marketLists as any[]).find(l => l.id === i.list_id);
          addResult(i.id, i.name, list?.name, "market_item");
        }
      });

      // Task lists & items
      (taskLists as any[]).forEach(l => {
        if (l.name?.toLowerCase().includes(lq)) addResult(l.id, l.name, undefined, "task_list");
      });
      (taskItems as any[]).forEach(i => {
        if (i.name?.toLowerCase().includes(lq)) {
          const list = (taskLists as any[]).find(l => l.id === i.list_id);
          addResult(i.id, i.name, list?.name, "task_item");
        }
      });

      // Calendar events
      (events as any[]).forEach(e => {
        if (e.title?.toLowerCase().includes(lq)) addResult(e.id, e.title, e.date, "calendar_event");
      });

      // Budgets
      (budgets as any[]).forEach(b => {
        const label = b.label || b.month || "";
        if (label.toLowerCase().includes(lq)) addResult(b.id, label, b.type, "budget");
      });

      // Debts
      (debts as any[]).forEach(d => {
        if (d.person_name?.toLowerCase().includes(lq)) {
          const dir = d.direction === "owed_to_me" ? "لي" : "عليّ";
          addResult(d.id, d.person_name, `${d.amount} - ${dir}`, "debt");
        }
      });

      // Trips
      (trips as any[]).forEach(t => {
        if (t.name?.toLowerCase().includes(lq) || t.destination?.toLowerCase().includes(lq))
          addResult(t.id, t.name, t.destination, "trip");
      });

      // Documents
      (docLists as any[]).forEach(l => {
        if (l.name?.toLowerCase().includes(lq)) addResult(l.id, l.name, undefined, "document");
      });
      (docItems as any[]).forEach(i => {
        if (i.name?.toLowerCase().includes(lq)) {
          const list = (docLists as any[]).find(l => l.id === i.list_id);
          addResult(i.id, i.name, list?.name, "document");
        }
      });

      // Places
      (places as any[]).forEach(p => {
        if (p.name?.toLowerCase().includes(lq) || p.address?.toLowerCase().includes(lq))
          addResult(p.id, p.name, p.address || p.category, "place");
      });

      // Medications
      (medications as any[]).forEach(m => {
        if (m.name?.toLowerCase().includes(lq)) addResult(m.id, m.name, m.member_name, "medication");
      });

      // Vehicles
      (vehicles as any[]).forEach(v => {
        const label = [v.brand, v.model, v.plate].filter(Boolean).join(" ");
        if (label.toLowerCase().includes(lq)) addResult(v.id, label, v.year?.toString(), "vehicle");
      });

      // Albums
      (albums as any[]).forEach(a => {
        if (a.name?.toLowerCase().includes(lq)) addResult(a.id, a.name, undefined, "album");
      });

      // Family members
      (members as any[]).forEach(m => {
        const name = profileMap.get(m.user_id) || "";
        if (name.toLowerCase().includes(lq)) addResult(m.id, name, m.role, "member");
      });

    } catch (e) {
      console.error("Search error:", e);
    }

    setResults(found.slice(0, 30));
    setLoading(false);
  }, []);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => searchLocal(query), 200);
    return () => clearTimeout(t);
  }, [query, searchLocal]);

  const handleSelect = (result: SearchResult) => {
    onClose();
    navigate(result.path);
  };

  // Group results by type
  const grouped = useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    results.forEach(r => {
      if (!map.has(r.typeLabel)) map.set(r.typeLabel, []);
      map.get(r.typeLabel)!.push(r);
    });
    return map;
  }, [results]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-background/98 backdrop-blur-md"
        dir="rtl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b border-border/50">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <div className="flex-1 relative">
              <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="ابحث في كل شيء..."
                className="w-full h-11 pr-10 pl-4 rounded-xl bg-muted/60 border border-border/40 text-foreground placeholder:text-muted-foreground/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                autoComplete="off"
                autoCorrect="off"
              />
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:bg-muted transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-2xl mx-auto px-4 pt-2 pb-20 overflow-y-auto" style={{ maxHeight: "calc(100vh - 70px)" }}>
          {/* Empty state */}
          {query.length < 2 && (
            <div className="flex flex-col items-center justify-center pt-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
                <Search size={28} className="text-muted-foreground/40" />
              </div>
              <p className="text-muted-foreground/60 text-sm">اكتب حرفين على الأقل للبحث</p>
              <div className="flex flex-wrap gap-2 mt-6 justify-center">
                {["سوق", "مهام", "مناسبات", "ديون", "رحلات", "أدوية"].map(tag => (
                  <button
                    key={tag}
                    onClick={() => setQuery(tag)}
                    className="px-3 py-1.5 rounded-lg bg-muted/50 text-xs text-muted-foreground hover:bg-muted transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && query.length >= 2 && (
            <div className="flex items-center justify-center pt-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}

          {/* No results */}
          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="flex flex-col items-center justify-center pt-20 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted/40 flex items-center justify-center mb-3">
                <Search size={24} className="text-muted-foreground/30" />
              </div>
              <p className="text-muted-foreground text-sm font-medium">لا توجد نتائج لـ "{query}"</p>
              <p className="text-muted-foreground/50 text-xs mt-1">جرّب كلمات مختلفة</p>
            </div>
          )}

          {/* Results */}
          {!loading && results.length > 0 && (
            <div className="space-y-4 pb-4">
              <p className="text-xs text-muted-foreground/60 px-1">{results.length} نتيجة</p>
              {Array.from(grouped.entries()).map(([typeLabel, items]) => (
                <div key={typeLabel}>
                  <div className="flex items-center gap-2 px-1 mb-2">
                    <span
                      className="w-6 h-6 rounded-md flex items-center justify-center text-white"
                      style={{ backgroundColor: items[0].color }}
                    >
                      {items[0].icon}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">{typeLabel}</span>
                    <span className="text-[10px] text-muted-foreground/40">({items.length})</span>
                  </div>
                  <div className="space-y-1">
                    {items.map((r, i) => (
                      <motion.button
                        key={r.id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02 }}
                        onClick={() => handleSelect(r)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/60 active:bg-muted transition-colors text-right"
                      >
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: r.color + "18", color: r.color }}
                        >
                          {r.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                          {r.subtitle && (
                            <p className="text-xs text-muted-foreground/60 truncate mt-0.5">{r.subtitle}</p>
                          )}
                        </div>
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-md shrink-0"
                          style={{ backgroundColor: r.color + "15", color: r.color }}
                        >
                          {r.typeLabel}
                        </span>
                      </motion.button>
                    ))}
                  </div>
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
