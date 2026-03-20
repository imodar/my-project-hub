import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, Star, Download, ChevronLeft, Plus, Trash2, TrendingUp, Eye } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  categories, allItems, TOTAL_ITEMS,
  type ChildProfile, type MonthData,
  loadChildren, saveChildren, loadData, saveData, getMonthLabel,
} from "@/components/kids-worship/worshipData";
import { exportWorshipPdf } from "@/components/kids-worship/exportPdf";
import MonthDaySelector from "@/components/kids-worship/MonthDaySelector";

const ParentDashboard = () => {
  const navigate = useNavigate();
  const now = new Date();
  const [children, setChildren] = useState<ChildProfile[]>(loadChildren);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [newChildName, setNewChildName] = useState("");
  const [showAddChild, setShowAddChild] = useState(false);
  const [editingData, setEditingData] = useState<MonthData | null>(null);

  const totalDays = new Date(selectedYear, selectedMonth + 1, 0).getDate();

  // Load all children's data for summaries
  const childrenData = useMemo(() => {
    const map: Record<string, MonthData> = {};
    children.forEach((child) => {
      map[child.id] = loadData(child.id, selectedYear, selectedMonth);
    });
    return map;
  }, [children, selectedYear, selectedMonth]);

  // Weekly summary for a child
  const getWeeklySummary = (childId: string) => {
    const data = childrenData[childId] || {};
    const today = now.getDate();
    const weekStart = Math.max(1, today - 6);
    let totalDone = 0;
    let totalPossible = 0;
    let fullDays = 0;

    for (let d = weekStart; d <= today; d++) {
      const dd = data[d] || {};
      const done = Object.values(dd).filter(Boolean).length;
      totalDone += done;
      totalPossible += TOTAL_ITEMS;
      if (done === TOTAL_ITEMS) fullDays++;
    }

    return {
      percentage: totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0,
      fullDays,
      daysTracked: today - weekStart + 1,
    };
  };

  const addChild = () => {
    if (!newChildName.trim()) return;
    const newChild: ChildProfile = {
      id: `child-${Date.now()}`,
      name: newChildName.trim(),
    };
    const updated = [...children, newChild];
    setChildren(updated);
    saveChildren(updated);
    setNewChildName("");
    setShowAddChild(false);
    toast({ title: `تمت إضافة ${newChild.name}` });
  };

  const removeChild = (id: string) => {
    const updated = children.filter((c) => c.id !== id);
    setChildren(updated);
    saveChildren(updated);
    toast({ title: "تم حذف الطفل" });
  };

  const handleExportPdf = async (childId: string) => {
    const data = childrenData[childId] || {};
    const child = children.find((c) => c.id === childId);
    await exportWorshipPdf(data, selectedYear, selectedMonth, child?.name || "", totalDays);
    toast({ title: "تم تصدير الجدول بنجاح ✅" });
  };

  // Temporary: fill all days for testing PDF alignment
  const fillAllData = (childId: string) => {
    const items = allItems.map(i => i.id);
    const fullData: MonthData = {};
    for (let day = 1; day <= totalDays; day++) {
      fullData[day] = {};
      items.forEach(id => { fullData[day][id] = true; });
    }
    saveData(childId, selectedYear, selectedMonth, fullData);
    // Force refresh
    window.location.reload();
  };

  const openChildEditor = (childId: string) => {
    setSelectedChild(childId);
    setEditingData(childrenData[childId] || {});
    setSelectedDay(now.getDate());
  };

  const toggleItemForChild = (itemId: string) => {
    if (!selectedChild || !editingData) return;
    const dayData = editingData[selectedDay] || {};
    const newDayData = { ...dayData, [itemId]: !dayData[itemId] };
    const newData = { ...editingData, [selectedDay]: newDayData };
    setEditingData(newData);
    saveData(selectedChild, selectedYear, selectedMonth, newData);
  };

  const getDayStatus = (day: number): "full" | "partial" | "empty" => {
    if (!editingData) return "empty";
    const dd = editingData[day] || {};
    const done = Object.values(dd).filter(Boolean).length;
    if (done === TOTAL_ITEMS) return "full";
    if (done > 0) return "partial";
    return "empty";
  };

  // If editing a specific child
  if (selectedChild && editingData) {
    const child = children.find((c) => c.id === selectedChild);
    const dayData = editingData[selectedDay] || {};
    const doneCount = Object.values(dayData).filter(Boolean).length;

    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 via-pink-50 to-amber-50 pb-28" dir="rtl">
        <PageHeader
          title={`تعديل عبادات ${child?.name}`}
          subtitle="وضع الأهل - يمكنك تعديل أي يوم"
          actions={[
            {
              icon: <ChevronLeft size={18} className="text-white" />,
              onClick: () => { setSelectedChild(null); setEditingData(null); },
            },
          ]}
        />

        <div className="mt-4">
          <MonthDaySelector
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            selectedDay={selectedDay}
            onMonthChange={(y, m) => {
              setSelectedYear(y);
              setSelectedMonth(m);
              setEditingData(loadData(selectedChild, y, m));
            }}
            onDayChange={setSelectedDay}
            dayStatus={getDayStatus}
          />
        </div>

        <div className="px-4 mt-3">
          <div className="bg-white/80 rounded-xl px-3 py-2 flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">الإنجاز</span>
            <span className="text-sm font-bold" style={{ color: "hsl(270 55% 50%)" }}>
              {doneCount}/{TOTAL_ITEMS}
            </span>
          </div>
        </div>

        {/* Worship Grid */}
        <div className="px-4 mt-4 space-y-3">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="bg-white rounded-2xl overflow-hidden shadow-sm border"
              style={{ borderColor: `${cat.color}22` }}
            >
              <div className="px-4 py-2 flex items-center gap-2" style={{ background: cat.bg }}>
                <div className="w-2 h-2 rounded-full" style={{ background: cat.color }} />
                <h3 className="text-xs font-extrabold" style={{ color: cat.color }}>{cat.label}</h3>
                <span className="text-[10px] font-semibold mr-auto px-2 py-0.5 rounded-full"
                  style={{ background: `${cat.color}18`, color: cat.color }}>
                  {cat.items.filter((i) => dayData[i.id]).length}/{cat.items.length}
                </span>
              </div>
              <div className="p-2.5 flex flex-wrap gap-1.5">
                {cat.items.map((item) => {
                  const done = !!dayData[item.id];
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleItemForChild(item.id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all active:scale-95"
                      style={{
                        background: done ? cat.bg : "hsl(0 0% 97%)",
                        border: `1.5px solid ${done ? cat.color : "hsl(0 0% 90%)"}`,
                      }}
                    >
                      <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background: done ? cat.color : "transparent",
                          border: `2px solid ${done ? cat.color : "hsl(0 0% 78%)"}`,
                        }}>
                        {done && <span className="text-white text-[8px]">✓</span>}
                      </div>
                      <span className="text-[11px] font-bold" style={{ color: done ? cat.color : "hsl(0 0% 40%)" }}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Main dashboard view
  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 via-pink-50 to-amber-50 pb-28" dir="rtl">
      <PageHeader
        title="متابعة عبادات الأطفال"
        subtitle="لوحة تحكم الأبوين"
      />

      {/* Month selector */}
      <div className="px-4 mt-2">
        <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-border/40 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-foreground">
              {getMonthLabel(selectedYear, selectedMonth)}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const d = new Date(selectedYear, selectedMonth - 1, 1);
                setSelectedYear(d.getFullYear());
                setSelectedMonth(d.getMonth());
              }}
              className="p-1.5 rounded-lg bg-muted/50 active:scale-95 transition-transform"
            >
              <ChevronLeft size={16} className="text-muted-foreground rotate-180" />
            </button>
            <button
              onClick={() => {
                const d = new Date(selectedYear, selectedMonth + 1, 1);
                setSelectedYear(d.getFullYear());
                setSelectedMonth(d.getMonth());
              }}
              className="p-1.5 rounded-lg bg-muted/50 active:scale-95 transition-transform"
            >
              <ChevronLeft size={16} className="text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Children List */}
      <div className="px-4 mt-4 space-y-3">
        {children.map((child) => {
          const summary = getWeeklySummary(child.id);
          const monthData = childrenData[child.id] || {};
          const totalStars = Object.values(monthData).filter(
            (dd) => Object.values(dd).filter(Boolean).length === TOTAL_ITEMS
          ).length;

          return (
            <motion.div
              key={child.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-4 shadow-sm border border-purple-100/40"
            >
              {/* Child header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                    style={{ background: "hsl(270 55% 94%)", color: "hsl(270 55% 50%)" }}>
                    {child.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{child.name}</h3>
                    <p className="text-[10px] text-muted-foreground">
                      ⭐ {totalStars} أيام كاملة هذا الشهر
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeChild(child.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 active:scale-95 transition-all"
                >
                  <Trash2 size={14} className="text-red-400" />
                </button>
              </div>

              {/* Weekly summary */}
              <div className="bg-gradient-to-l from-purple-50 to-pink-50 rounded-xl p-3 mb-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp size={14} style={{ color: "hsl(270 55% 50%)" }} />
                  <span className="text-[11px] font-bold" style={{ color: "hsl(270 55% 50%)" }}>
                    ملخص آخر 7 أيام
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-purple-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${summary.percentage}%`,
                          background: summary.percentage >= 80
                            ? "linear-gradient(90deg, hsl(160 50% 45%), hsl(160 60% 40%))"
                            : summary.percentage >= 50
                            ? "linear-gradient(90deg, hsl(40 90% 50%), hsl(35 80% 50%))"
                            : "linear-gradient(90deg, hsl(340 55% 50%), hsl(340 60% 45%))",
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-bold" style={{ color: "hsl(270 55% 50%)" }}>
                    {summary.percentage}%
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  {summary.fullDays} أيام كاملة من {summary.daysTracked}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={() => openChildEditor(child.id)}
                  variant="outline"
                  size="sm"
                  className="flex-1 h-9 rounded-xl text-xs gap-1.5"
                >
                  <Eye size={14} />
                  عرض وتعديل
                </Button>
                <Button
                  onClick={() => handleExportPdf(child.id)}
                  size="sm"
                  className="flex-1 h-9 rounded-xl text-xs gap-1.5"
                  style={{ background: "linear-gradient(135deg, hsl(270 55% 50%), hsl(340 55% 50%))" }}
                >
                  <Download size={14} />
                  تصدير PDF
                </Button>
              </div>
              {/* Temporary test button */}
              <Button
                onClick={() => fillAllData(child.id)}
                variant="outline"
                size="sm"
                className="w-full h-8 rounded-xl text-xs mt-2 border-amber-300 text-amber-700 bg-amber-50"
              >
                🧪 تعبئة كل الشهر (للاختبار)
              </Button>
            </motion.div>
          );
        })}

        {/* Add child */}
        {showAddChild ? (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-purple-100/40">
            <input
              type="text"
              value={newChildName}
              onChange={(e) => setNewChildName(e.target.value)}
              placeholder="اسم الطفل"
              className="w-full px-4 py-2.5 rounded-xl border border-border/50 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && addChild()}
            />
            <div className="flex gap-2">
              <Button onClick={addChild} size="sm" className="flex-1 h-9 rounded-xl text-xs">
                إضافة
              </Button>
              <Button
                onClick={() => { setShowAddChild(false); setNewChildName(""); }}
                variant="outline"
                size="sm"
                className="flex-1 h-9 rounded-xl text-xs"
              >
                إلغاء
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddChild(true)}
            className="w-full bg-white/60 rounded-2xl p-4 border-2 border-dashed border-purple-200 flex items-center justify-center gap-2 text-sm font-bold active:scale-[0.98] transition-transform"
            style={{ color: "hsl(270 55% 50%)" }}
          >
            <Plus size={18} />
            إضافة طفل
          </button>
        )}
      </div>
    </div>
  );
};

export default ParentDashboard;
