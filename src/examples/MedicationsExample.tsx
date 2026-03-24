/**
 * مثال توضيحي — صفحة الأدوية مع Offline-First
 *
 * هذا الملف يوضّح كيفية استخدام:
 * 1. useOfflineFirst — لقراءة البيانات من IndexedDB + API
 * 2. useOfflineMutation — لإضافة بيانات مع optimistic update
 * 3. SyncStatus — لعرض حالة المزامنة
 *
 * ⚠️ هذا مثال توضيحي فقط — لا يُضاف للـ router ولا يُعدّل أي ملف موجود.
 */
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFamilyId } from "@/hooks/useFamilyId";
import { useOfflineFirst } from "@/hooks/useOfflineFirst";
import { useOfflineMutation } from "@/hooks/useOfflineMutation";
import SyncStatus from "@/components/SyncStatus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pill, Plus, Loader2, RefreshCw } from "lucide-react";

/* ────────────────────────────────────────────
 *  نوع الدواء (مبسّط للمثال)
 * ──────────────────────────────────────────── */
interface Medication {
  id: string;
  name: string;
  dosage: string | null;
  family_id: string;
  created_at: string;
}

/* ────────────────────────────────────────────
 *  المكوّن الرئيسي
 * ──────────────────────────────────────────── */
const MedicationsExample = () => {
  const { user } = useAuth();
  const { familyId } = useFamilyId();
  const [newName, setNewName] = useState("");
  const [newDosage, setNewDosage] = useState("");

  // ── 1. قراءة الأدوية: IndexedDB أولاً → ثم API في الخلفية ──
  const { data: medications, isLoading, isSyncing, refetch } = useOfflineFirst<Medication>({
    table: "medications",
    queryKey: ["medications-example", familyId],
    apiFn: async () => {
      if (!familyId) return { data: [], error: null };
      const { data, error } = await supabase
        .from("medications")
        .select("id, name, dosage, family_id, created_at")
        .eq("family_id", familyId)
        .order("created_at", { ascending: false });
      return { data: data ?? [], error: error?.message ?? null };
    },
    // فلترة محلية حسب family_id
    filterFn: (items) =>
      familyId ? items.filter((m) => m.family_id === familyId) : items,
    enabled: !!familyId,
  });

  // ── 2. إضافة دواء: optimistic update + sync queue ──
  const addMutation = useOfflineMutation<Medication, Record<string, unknown>>({
    table: "medications",
    operation: "INSERT",
    apiFn: async (data) => {
      const { error } = await supabase.from("medications").insert(data as never);
      return { data: data as unknown as Medication, error: error?.message ?? null };
    },
    queryKey: ["medications-example", familyId],
    onSuccess: () => {
      setNewName("");
      setNewDosage("");
    },
  });

  // ── 3. حذف دواء: optimistic update ──
  const deleteMutation = useOfflineMutation<null, Record<string, unknown>>({
    table: "medications",
    operation: "DELETE",
    apiFn: async (data) => {
      const { error } = await supabase
        .from("medications")
        .delete()
        .eq("id", data.id as string);
      return { data: null, error: error?.message ?? null };
    },
    queryKey: ["medications-example", familyId],
  });

  const handleAdd = () => {
    if (!newName.trim() || !familyId) return;
    addMutation.mutate({
      id: crypto.randomUUID(),
      name: newName.trim(),
      dosage: newDosage.trim() || null,
      family_id: familyId,
      created_at: new Date().toISOString(),
    });
  };

  return (
    <div className="min-h-screen bg-background p-4" dir="rtl">
      {/* ── العنوان + حالة المزامنة ── */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-foreground">
          مثال Offline-First — الأدوية
        </h1>
        {/* مؤشر حالة المزامنة مع النص */}
        <SyncStatus showLabel size="md" />
      </div>

      {/* ── نموذج إضافة دواء ── */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">إضافة دواء جديد</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="اسم الدواء"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Input
            placeholder="الجرعة (اختياري)"
            value={newDosage}
            onChange={(e) => setNewDosage(e.target.value)}
          />
          <Button
            onClick={handleAdd}
            disabled={!newName.trim() || addMutation.isPending}
            className="w-full"
          >
            {addMutation.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Plus />
            )}
            إضافة
          </Button>
        </CardContent>
      </Card>

      {/* ── زر إعادة المزامنة ── */}
      <div className="flex items-center gap-2 mb-4">
        <Button variant="outline" size="sm" onClick={refetch}>
          <RefreshCw className={isSyncing ? "animate-spin" : ""} />
          {isSyncing ? "يتزامن..." : "مزامنة"}
        </Button>
        <Badge variant="secondary">
          {medications.length} دواء
        </Badge>
      </div>

      {/* ── قائمة الأدوية ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-muted-foreground" size={32} />
        </div>
      ) : medications.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          لا توجد أدوية — أضف دواء جديد أعلاه
        </p>
      ) : (
        <div className="space-y-2">
          {medications.map((med) => (
            <Card key={med.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Pill className="text-primary shrink-0" size={20} />
                  <div>
                    <p className="font-medium text-foreground">{med.name}</p>
                    {med.dosage && (
                      <p className="text-sm text-muted-foreground">{med.dosage}</p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => deleteMutation.mutate({ id: med.id })}
                >
                  حذف
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MedicationsExample;
