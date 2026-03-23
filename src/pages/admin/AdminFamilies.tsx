import { useState } from "react";
import { useAdminFamilies } from "@/hooks/useAdminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, ChevronLeft, ChevronRight, Eye, Users } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export default function AdminFamilies() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedFamily, setSelectedFamily] = useState<any>(null);

  const { data, isLoading } = useAdminFamilies(page, search);
  const families = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 20);

  const handleSearch = () => { setPage(1); setSearch(searchInput); };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>العائلات ({total})</CardTitle>
          <div className="flex gap-2 mt-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="بحث باسم العائلة..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} className="pr-9" />
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
                    <TableHead>اسم العائلة</TableHead>
                    <TableHead>عدد الأعضاء</TableHead>
                    <TableHead>كود الدعوة</TableHead>
                    <TableHead>تاريخ الإنشاء</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {families.map((f: any) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="gap-1">
                          <Users className="h-3 w-3" /> {f.member_count || 0}
                        </Badge>
                      </TableCell>
                      <TableCell dir="ltr" className="text-left font-mono text-xs">{f.invite_code || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(f.created_at), "dd MMM yyyy", { locale: ar })}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => setSelectedFamily(f)}><Eye className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-4">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronRight className="h-4 w-4" /></Button>
              <span className="text-sm">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronLeft className="h-4 w-4" /></Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Family detail */}
      <Dialog open={!!selectedFamily} onOpenChange={() => setSelectedFamily(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader><DialogTitle>تفاصيل العائلة: {selectedFamily?.name}</DialogTitle></DialogHeader>
          {selectedFamily && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">عدد الأعضاء:</span> <strong>{selectedFamily.member_count}</strong></div>
                <div><span className="text-muted-foreground">كود الدعوة:</span> <strong dir="ltr">{selectedFamily.invite_code || "—"}</strong></div>
                <div><span className="text-muted-foreground">تاريخ الإنشاء:</span> <strong>{format(new Date(selectedFamily.created_at), "dd MMM yyyy", { locale: ar })}</strong></div>
              </div>
              {selectedFamily.members && selectedFamily.members.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">الأعضاء</h4>
                  <div className="space-y-2">
                    {selectedFamily.members.map((m: any) => (
                      <div key={m.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm">
                        <span>{m.profile_name || "بدون اسم"}</span>
                        <div className="flex gap-2">
                          <Badge variant="outline">{m.role}</Badge>
                          {m.is_admin && <Badge>مشرف</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
