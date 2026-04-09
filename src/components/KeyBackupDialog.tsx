/**
 * KeyBackupDialog — حوار نسخ احتياطية لمفتاح التشفير
 *
 * يتيح للمستخدم:
 * - تصدير مفتاحه الخاص المشفر بكلمة مرور (JSON download)
 * - استيراد نسخة احتياطية سابقة واستعادة المفتاح
 *
 * يستخدم PBKDF2 (200,000 تكرار) + AES-256-GCM لحماية المفتاح.
 */
import { useState, useRef } from "react";
import { Shield, Download, Upload, Eye, EyeOff, KeyRound, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { appToast } from "@/lib/toast";
import {
  exportPrivateKeyWithPassphrase,
  importPrivateKeyFromBackup,
  savePrivateKeyLocally,
  loadPrivateKeyLocally,
} from "@/lib/crypto";
import { useAuth } from "@/contexts/AuthContext";

interface KeyBackupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function KeyBackupDialog({ open, onOpenChange }: KeyBackupDialogProps) {
  const { user } = useAuth();

  // Export state
  const [exportPassphrase, setExportPassphrase] = useState("");
  const [exportConfirm, setExportConfirm] = useState("");
  const [showExportPass, setShowExportPass] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  // Import state
  const [importPassphrase, setImportPassphrase] = useState("");
  const [showImportPass, setShowImportPass] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    if (!user) return;
    if (exportPassphrase.length < 8) {
      appToast.error("كلمة المرور قصيرة", "يجب أن تكون 8 أحرف على الأقل");
      return;
    }
    if (exportPassphrase !== exportConfirm) {
      appToast.error("كلمات المرور لا تتطابق", "أعد إدخال كلمة التأكيد");
      return;
    }

    setIsExporting(true);
    try {
      const privateKey = await loadPrivateKeyLocally(user.id);
      if (!privateKey) {
        appToast.error("لا يوجد مفتاح", "لم يتم العثور على مفتاح التشفير. افتح المحادثات أولاً لإنشائه.");
        return;
      }

      const backup = await exportPrivateKeyWithPassphrase(privateKey, exportPassphrase);
      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `family-key-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setExportDone(true);
      setExportPassphrase("");
      setExportConfirm("");
      appToast.success("تم التصدير", "احفظ الملف في مكان آمن");
    } catch {
      appToast.error("فشل التصدير", "حدث خطأ غير متوقع");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    if (!user || !importFile) return;
    if (!importPassphrase) {
      appToast.error("كلمة المرور مطلوبة", "أدخل كلمة المرور التي استخدمتها عند التصدير");
      return;
    }

    setIsImporting(true);
    try {
      const text = await importFile.text();
      const backup = JSON.parse(text);

      const restoredKey = await importPrivateKeyFromBackup(backup, importPassphrase);
      await savePrivateKeyLocally(user.id, restoredKey);

      appToast.success("تم الاستيراد", "تم استعادة مفتاح التشفير بنجاح. أعد تشغيل المحادثات.");
      setImportFile(null);
      setImportPassphrase("");
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error && err.message.includes("غير صحيحة")
          ? err.message
          : "تعذر استيراد المفتاح. تحقق من الملف وكلمة المرور.";
      appToast.error("فشل الاستيراد", message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent dir="rtl" className="max-h-[92dvh]">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <KeyRound size={18} className="text-primary" />
            نسخ احتياطي لمفتاح التشفير
          </DrawerTitle>
          <DrawerDescription>
            مفتاح التشفير يُخزَّن فقط على جهازك. إذا فقدت جهازك، لن تتمكن من قراءة الرسائل القديمة بدون نسخة احتياطية.
          </DrawerDescription>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 pb-8 space-y-6">
          {/* Security notice */}
          <div className="flex gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
            <Shield size={15} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              النسخة الاحتياطية مشفرة بكلمة مرورك. لا يمكن لأحد — حتى مطوري التطبيق — فتحها بدون كلمة المرور.
            </p>
          </div>

          {/* ── Export section ── */}
          <section>
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Download size={14} className="text-primary" />
              تصدير نسخة احتياطية
            </h3>

            {exportDone ? (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50">
                <CheckCircle2 size={16} className="text-green-600" />
                <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                  تم تحميل النسخة الاحتياطية بنجاح
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">كلمة المرور</label>
                  <div className="relative">
                    <Input
                      type={showExportPass ? "text" : "password"}
                      placeholder="أدخل كلمة مرور قوية (8 أحرف+)"
                      value={exportPassphrase}
                      onChange={(e) => setExportPassphrase(e.target.value)}
                      className="pr-10 text-sm"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowExportPass(!showExportPass)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      aria-label={showExportPass ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                    >
                      {showExportPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">تأكيد كلمة المرور</label>
                  <Input
                    type="password"
                    placeholder="أعد إدخال كلمة المرور"
                    value={exportConfirm}
                    onChange={(e) => setExportConfirm(e.target.value)}
                    className="text-sm"
                    dir="ltr"
                  />
                </div>
                {exportPassphrase && exportConfirm && exportPassphrase !== exportConfirm && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle size={11} />
                    كلمات المرور لا تتطابق
                  </p>
                )}
                <Button
                  onClick={handleExport}
                  disabled={
                    isExporting ||
                    exportPassphrase.length < 8 ||
                    exportPassphrase !== exportConfirm
                  }
                  className="w-full"
                  size="sm"
                >
                  <Download size={14} className="ml-2" />
                  {isExporting ? "جارٍ التصدير..." : "تصدير وتنزيل"}
                </Button>
              </div>
            )}
          </section>

          <hr className="border-border" />

          {/* ── Import section ── */}
          <section>
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Upload size={14} className="text-primary" />
              استيراد نسخة احتياطية
            </h3>

            <div className="space-y-3">
              {/* File picker */}
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload size={13} className="ml-2" />
                  {importFile ? importFile.name : "اختر ملف النسخة الاحتياطية (.json)"}
                </Button>
              </div>

              {importFile && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">كلمة المرور</label>
                  <div className="relative">
                    <Input
                      type={showImportPass ? "text" : "password"}
                      placeholder="كلمة المرور المستخدمة عند التصدير"
                      value={importPassphrase}
                      onChange={(e) => setImportPassphrase(e.target.value)}
                      className="pr-10 text-sm"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowImportPass(!showImportPass)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      aria-label={showImportPass ? "إخفاء" : "إظهار"}
                    >
                      {showImportPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              )}

              <Button
                onClick={handleImport}
                disabled={isImporting || !importFile || !importPassphrase}
                variant="outline"
                className="w-full"
                size="sm"
              >
                <Upload size={14} className="ml-2" />
                {isImporting ? "جارٍ الاستيراد..." : "استيراد واستعادة المفتاح"}
              </Button>
            </div>
          </section>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
