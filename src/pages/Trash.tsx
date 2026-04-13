import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Trash2, RotateCcw, Clock, CalendarDays, CreditCard, Users, AlertTriangle, ShoppingCart, ListChecks, Loader2 } from "lucide-react";
import { useTrash, TrashItem } from "@/contexts/TrashContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { appToast } from "@/lib/toast";

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  event: { label: "مناسبة", icon: CalendarDays, color: "hsl(var(--primary))" },
  debt: { label: "دين", icon: CreditCard, color: "hsl(var(--accent))" },
  family_member: { label: "عضو عائلة", icon: Users, color: "hsl(var(--destructive))" },
  market_list: { label: "قائمة تسوق", icon: ShoppingCart, color: "hsl(145, 45%, 40%)" },
  task_list: { label: "قائمة مهام", icon: ListChecks, color: "hsl(215, 70%, 50%)" },
};

function daysRemaining(deletedAt: Date) {
  const now = new Date();
  const diff = 30 - Math.floor((now.getTime() - new Date(deletedAt).getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

const Trash = () => {
  const navigate = useNavigate();
  const { trashItems, restoreItem, permanentlyDelete } = useTrash();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleRestore = async (item: TrashItem) => {
    await restoreItem(item.id);
  };

  const handlePermanentDelete = async () => {
    if (deleteConfirm) {
      setIsDeleting(true);
      try {
        await permanentlyDelete(deleteConfirm);
        appToast.success("تم الحذف نهائياً");
        setDeleteConfirm(null);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const grouped = trashItems.reduce((acc, item) => {
    if (item.isShared) {
      (acc.shared = acc.shared || []).push(item);
    } else {
      (acc.personal = acc.personal || []).push(item);
    }
    return acc;
  }, {} as Record<string, TrashItem[]>);

  return (
    <div className="min-h-screen flex flex-col pb-20 bg-background" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between p-4" style={{ paddingTop: "max(env(safe-area-inset-top), 16px)" }}>
        <div className="w-16" />
        <h1 className="text-lg font-bold text-foreground">سلة المحذوفات</h1>
        <button onClick={() => navigate("/settings")}
          className="flex items-center gap-1 px-3 py-2 rounded-2xl text-sm font-semibold text-foreground bg-muted">
          رجوع
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Policy notice */}
      <div className="mx-4 mb-4 p-3 rounded-2xl flex items-start gap-2.5" style={{ background: "hsl(43, 55%, 54%, 0.1)", border: "1px solid hsl(43, 55%, 54%, 0.2)" }}>
        <AlertTriangle size={16} style={{ color: "hsl(43, 55%, 48%)" }} className="shrink-0 mt-0.5" />
        <p className="text-xs text-foreground/80 leading-relaxed">
          العناصر المحذوفة تبقى هنا لمدة <strong>٣٠ يوماً</strong> ثم تُحذف تلقائياً من الحساب العائلي بشكل نهائي.
        </p>
      </div>

      <div className="flex-1 px-4 pb-8 space-y-6">
        {trashItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Trash2 size={28} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">سلة المحذوفات فارغة</p>
            <p className="text-xs text-muted-foreground mt-1">لم يتم حذف أي عناصر بعد</p>
          </div>
        )}

        {/* Shared items */}
        {grouped.shared && grouped.shared.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground mb-2 px-1">عناصر مشتركة (العائلة)</h2>
            <div className="space-y-2">
              {grouped.shared.map((item) => (
                <TrashCard key={item.id} item={item} onRestore={handleRestore} onDelete={setDeleteConfirm} />
              ))}
            </div>
          </div>
        )}

        {/* Personal items */}
        {grouped.personal && grouped.personal.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground mb-2 px-1">عناصر شخصية</h2>
            <div className="space-y-2">
              {grouped.personal.map((item) => (
                <TrashCard key={item.id} item={item} onRestore={handleRestore} onDelete={setDeleteConfirm} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Confirm permanent delete */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o) setDeleteConfirm(null); }}>
        <AlertDialogContent dir="rtl" className="rounded-2xl max-w-sm mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف نهائي؟</AlertDialogTitle>
            <AlertDialogDescription>
              لا يمكن التراجع عن هذا الإجراء. سيتم حذف العنصر بشكل نهائي.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handlePermanentDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              حذف نهائي
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const TrashCard = ({ item, onRestore, onDelete }: { item: TrashItem; onRestore: (i: TrashItem) => void; onDelete: (id: string) => void }) => {
  const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.event;
  const remaining = daysRemaining(item.deletedAt);
  const IconComp = config.icon;

  return (
    <div className="bg-card rounded-2xl border border-border p-3.5 flex items-center gap-3"
      style={{ boxShadow: "0 1px 6px hsla(0,0%,0%,0.04)" }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${config.color}15` }}>
        <IconComp size={18} style={{ color: config.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground truncate">{item.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
            style={{ background: `${config.color}10`, color: config.color }}>
            {config.label}
          </span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            <Clock size={10} /> متبقي {remaining} يوم
          </span>
        </div>
        {item.description && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{item.description}</p>}
      </div>
      <div className="flex gap-1.5 shrink-0">
        <button onClick={() => onRestore(item)}
          className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10 active:scale-90 transition-transform">
          <RotateCcw size={15} className="text-primary" />
        </button>
        <button onClick={() => onDelete(item.id)}
          className="w-9 h-9 rounded-xl flex items-center justify-center bg-destructive/10 active:scale-90 transition-transform">
          <Trash2 size={15} className="text-destructive" />
        </button>
      </div>
    </div>
  );
};

export default Trash;
