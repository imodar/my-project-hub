import { useState } from "react";
import { useAdminUsers, useAdminMutations } from "@/hooks/useAdminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, ChevronLeft, ChevronRight, Ban, CheckCircle, Eye } from "lucide-react";
import { appToast } from "@/lib/toast";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export default function AdminUsers() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [suspendDialog, setSuspendDialog] = useState<any>(null);
  const [suspendReason, setSuspendReason] = useState("");

  const { data, isLoading } = useAdminUsers(page, search);
  const { suspendUser, unsuspendUser } = useAdminMutations();

  const users = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 20);

  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const handleSuspend = async (userId: string) => {
    try {
      await suspendUser.mutateAsync({ target_user_id: userId, reason: suspendReason });
      appToast.success("تم تعليق المستخدم");
      setSuspendDialog(null);
      setSuspendReason("");
    } catch { appToast.error("فشل تعليق المستخدم"); }
  };

  const handleUnsuspend = async (userId: string) => {
    try {
      await unsuspendUser.mutateAsync({ target_user_id: userId });
      appToast.success("تم إلغاء التعليق");
    } catch { appToast.error("فشلت العملية"); }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>المستخدمين ({total})</span>
          </CardTitle>
          <div className="flex gap-2 mt-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم أو رقم الجوال..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pr-9"
              />
            </div>
            <Button onClick={handleSearch}>بحث</Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>الجوال</TableHead>
                    <TableHead>الاشتراك</TableHead>
                    <TableHead>آخر دخول</TableHead>
                    <TableHead>تاريخ التسجيل</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u: any) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name || "—"}</TableCell>
                      <TableCell dir="ltr" className="text-left">{u.phone || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={u.subscription_plan === "premium" ? "default" : "secondary"}>
                          {u.subscription_plan}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.last_login_at ? format(new Date(u.last_login_at), "dd MMM yyyy", { locale: ar }) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(u.created_at), "dd MMM yyyy", { locale: ar })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setSelectedUser(u)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setSuspendDialog(u)}>
                            <Ban className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-4">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="text-sm">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User detail dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>تفاصيل المستخدم</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">الاسم:</span><span className="font-medium">{selectedUser.name || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">الجوال:</span><span dir="ltr">{selectedUser.phone || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">الاشتراك:</span><Badge variant={selectedUser.subscription_plan === "premium" ? "default" : "secondary"}>{selectedUser.subscription_plan}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">آخر دخول:</span><span>{selectedUser.last_login_at ? format(new Date(selectedUser.last_login_at), "dd MMM yyyy HH:mm", { locale: ar }) : "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">تاريخ التسجيل:</span><span>{format(new Date(selectedUser.created_at), "dd MMM yyyy", { locale: ar })}</span></div>
              {selectedUser.subscription_expires_at && (
                <div className="flex justify-between"><span className="text-muted-foreground">انتهاء الاشتراك:</span><span>{format(new Date(selectedUser.subscription_expires_at), "dd MMM yyyy", { locale: ar })}</span></div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Suspend dialog */}
      <Dialog open={!!suspendDialog} onOpenChange={() => setSuspendDialog(null)}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعليق المستخدم</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">هل أنت متأكد من تعليق حساب <strong>{suspendDialog?.name}</strong>؟</p>
          <Input placeholder="سبب التعليق (اختياري)" value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSuspendDialog(null)}>إلغاء</Button>
            <Button variant="destructive" onClick={() => handleSuspend(suspendDialog?.id)} disabled={suspendUser.isPending}>
              تعليق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
