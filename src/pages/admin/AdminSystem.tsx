import { useState } from "react";
import { useAdminSettings, useAdminVersions, useAdminMutations } from "@/hooks/useAdminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { appToast } from "@/lib/toast";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export default function AdminSystem() {
  const { data: settingsData, isLoading: sl } = useAdminSettings();
  const { data: versionsData, isLoading: vl } = useAdminVersions();
  const { updateSetting, addVersion } = useAdminMutations();

  const [showAddVersion, setShowAddVersion] = useState(false);
  const [newVersion, setNewVersion] = useState({ version: "", release_notes: "", force_update: false, min_supported_version: "", update_message: "" });

  const settings = settingsData?.data || [];
  const versions = versionsData?.data || [];

  const handleAddVersion = async () => {
    if (!newVersion.version.trim()) return;
    try {
      await addVersion.mutateAsync(newVersion);
      appToast.success("تم إضافة الإصدار");
      setShowAddVersion(false);
      setNewVersion({ version: "", release_notes: "", force_update: false, min_supported_version: "", update_message: "" });
    } catch { appToast.error("فشلت الإضافة"); }
  };

  return (
    <div className="space-y-6">
      {/* Settings */}
      <Card>
        <CardHeader><CardTitle>إعدادات النظام</CardTitle></CardHeader>
        <CardContent>
          {sl ? <Skeleton className="h-32 w-full" /> : (
            <div className="space-y-3">
              {settings.length === 0 && <p className="text-muted-foreground text-center py-4">لا توجد إعدادات</p>}
              {settings.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">{s.key}</p>
                    <p className="text-sm text-muted-foreground">{JSON.stringify(s.value)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{format(new Date(s.updated_at), "dd MMM", { locale: ar })}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Versions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>إصدارات التطبيق</span>
            <Button size="sm" onClick={() => setShowAddVersion(true)} className="gap-1"><Plus className="h-4 w-4" /> إصدار جديد</Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {vl ? <Skeleton className="h-32 w-full" /> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الإصدار</TableHead>
                    <TableHead>ملاحظات</TableHead>
                    <TableHead>تحديث إجباري</TableHead>
                    <TableHead>الحد الأدنى</TableHead>
                    <TableHead>التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions.map((v: any) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono font-bold">{v.version}</TableCell>
                      <TableCell className="text-sm max-w-xs truncate">{v.release_notes || "—"}</TableCell>
                      <TableCell>{v.force_update ? <Badge variant="destructive">نعم</Badge> : <Badge variant="secondary">لا</Badge>}</TableCell>
                      <TableCell className="font-mono text-sm">{v.min_supported_version || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(v.created_at), "dd MMM yyyy", { locale: ar })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add version dialog */}
      <Dialog open={showAddVersion} onOpenChange={setShowAddVersion}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>إضافة إصدار جديد</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="رقم الإصدار (مثل 2.1.0)" value={newVersion.version} onChange={(e) => setNewVersion(v => ({ ...v, version: e.target.value }))} />
            <Textarea placeholder="ملاحظات الإصدار" value={newVersion.release_notes} onChange={(e) => setNewVersion(v => ({ ...v, release_notes: e.target.value }))} rows={3} />
            <Input placeholder="رسالة التحديث" value={newVersion.update_message} onChange={(e) => setNewVersion(v => ({ ...v, update_message: e.target.value }))} />
            <Input placeholder="الحد الأدنى المدعوم" value={newVersion.min_supported_version} onChange={(e) => setNewVersion(v => ({ ...v, min_supported_version: e.target.value }))} />
            <div className="flex items-center justify-between">
              <span className="text-sm">تحديث إجباري</span>
              <Switch checked={newVersion.force_update} onCheckedChange={(c) => setNewVersion(v => ({ ...v, force_update: c }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddVersion(false)}>إلغاء</Button>
            <Button onClick={handleAddVersion} disabled={!newVersion.version.trim() || addVersion.isPending}>إضافة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
