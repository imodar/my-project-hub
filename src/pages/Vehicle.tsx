import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
// skeleton is inlined below PageHeader
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { useVehicles } from "@/hooks/useVehicles";
import { useTrash } from "@/contexts/TrashContext";
import FAB from "@/components/FAB";
import { useNavigate } from "react-router-dom";
import { Plus, Car, Gauge, Fuel, Calendar, Wrench, ChevronLeft, Share2, Trash2, Bell, Pencil, Check, X, Filter, Droplets, Wind, Disc3, Zap, Sparkles, CircleDot, Settings2, AlertTriangle, Search, Users, UserPlus } from "lucide-react";
import SwipeableCard from "@/components/SwipeableCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { appToast } from "@/lib/toast";
import PageHeader from "@/components/PageHeader";
import PullToRefresh from "@/components/PullToRefresh";
import { CAR_BRANDS, POPULAR_COUNT, carLogoUrl, type CarBrand } from "@/data/carBrands";

// ─── Types ───
interface MaintenanceRecord {
  id: string;
  type: string;
  label: string;
  date: string;
  mileageAtService: number;
  nextMileage: number;
  nextDate: string;
  notes?: string;
}

interface CarData {
  id: string;
  manufacturer: string;
  model: string;
  year: string;
  mileage: number;
  mileageUnit: "km" | "mi";
  color?: string;
  plateNumber?: string;
  sharedWith: string[];
  maintenance: MaintenanceRecord[];
  createdAt: string;
}

// ─── Car Brand Lookup Maps (built once from carBrands.ts) ───
const BRAND_BY_SLUG: Record<string, CarBrand> = Object.fromEntries(
  CAR_BRANDS.map((b) => [b.slug, b])
);

const getBrandName = (slug: string): string =>
  BRAND_BY_SLUG[slug]?.name || slug;

const MAINTENANCE_TYPES = [
  { id: "oil_change", label: "تغيير زيت المحرك", icon: Droplets, color: "hsl(35 85% 50%)", hasFilter: true },
  { id: "oil_filter", label: "فلتر الزيت", icon: Filter, color: "hsl(35 65% 40%)" },
  { id: "air_filter", label: "فلتر الهواء", icon: Wind, color: "hsl(200 60% 50%)" },
  { id: "cabin_filter", label: "فلتر المكيف", icon: Sparkles, color: "hsl(180 50% 45%)" },
  { id: "fuel_filter", label: "فلتر الوقود", icon: Fuel, color: "hsl(0 60% 50%)" },
  { id: "brakes", label: "الفرامل", icon: Disc3, color: "hsl(0 70% 45%)" },
  { id: "tires", label: "الإطارات", icon: CircleDot, color: "hsl(220 10% 35%)" },
  { id: "battery", label: "البطارية", icon: Zap, color: "hsl(50 80% 50%)" },
  { id: "spark_plugs", label: "البواجي", icon: Zap, color: "hsl(270 50% 50%)" },
  { id: "transmission", label: "زيت القير", icon: Settings2, color: "hsl(200 40% 40%)" },
  { id: "coolant", label: "سائل التبريد", icon: Droplets, color: "hsl(195 80% 45%)" },
  { id: "timing_belt", label: "سير التايمنق", icon: Settings2, color: "hsl(160 40% 35%)" },
  { id: "other", label: "أخرى", icon: Wrench, color: "hsl(210 30% 45%)" },
];

// localStorage helpers removed — using Supabase hooks

// ─── Car Logo Component ───
const CarLogo = ({ manufacturer, size = 40 }: { manufacturer: string; size?: number }) => {
  const brand = BRAND_BY_SLUG[manufacturer];
  if (brand) {
    return (
      <img
        src={carLogoUrl(brand.slug)}
        alt={`شعار ${brand.name}`}
        className="object-contain"
        style={{ width: size, height: size }}
        loading="lazy"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
          (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
        }}
      />
    );
  }
  return <Car size={size * 0.6} className="text-muted-foreground" />;
};

// Using shared SwipeableCard component

// ─── Main Component ───
const Vehicle = () => {
  const navigate = useNavigate();
  const { vehicles: dbVehicles, isLoading: vehiclesLoading, addVehicle: addVehicleMut, updateVehicle: updateVehicleMut, deleteVehicle: deleteVehicleMut, addMaintenance: addMaintMut, updateMaintenance: updateMaintMut, deleteMaintenance: deleteMaintMut } = useVehicles();

  const cars: CarData[] = useMemo(() => (dbVehicles || []).map((v: any) => ({
    id: v.id,
    manufacturer: v.manufacturer,
    model: v.model,
    year: v.year || "",
    mileage: v.mileage || 0,
    mileageUnit: v.mileage_unit || "km",
    color: v.color || "",
    plateNumber: v.plate_number || "",
    sharedWith: v.shared_with || [],
    createdAt: v.created_at,
    maintenance: (v.vehicle_maintenance || []).map((m: any) => ({
      id: m.id,
      type: m.type,
      label: m.label,
      date: m.date || "",
      mileageAtService: m.mileage_at_service || 0,
      nextMileage: m.next_mileage || 0,
      nextDate: m.next_date || "",
      notes: m.notes || "",
    })),
  })), [dbVehicles]);

  const [selectedCar, setSelectedCar] = useState<CarData | null>(null);
  const [addCarOpen, setAddCarOpen] = useState(false);
  const [editCarOpen, setEditCarOpen] = useState(false);
  const [editingCar, setEditingCar] = useState<CarData | null>(null);
  const [addMaintenanceOpen, setAddMaintenanceOpen] = useState(false);
  const [editMaintenanceRecord, setEditMaintenanceRecord] = useState<MaintenanceRecord | null>(null);
  const [shareDrawerOpen, setShareDrawerOpen] = useState(false);
  const [shareWith, setShareWith] = useState<string[]>([]);
  const [manufacturerSearch, setManufacturerSearch] = useState("");

  // Family members for sharing
  const { members: familyMembers } = useFamilyMembers();

  const { addToTrash } = useTrash();
  const [deleteConfirmCar, setDeleteConfirmCar] = useState<CarData | null>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  // Add car form
  const [newManufacturer, setNewManufacturer] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newYear, setNewYear] = useState("");
  const [newMileage, setNewMileage] = useState("");
  const [newMileageUnit, setNewMileageUnit] = useState<"km" | "mi">("km");
  const [newColor, setNewColor] = useState("");
  const [newPlate, setNewPlate] = useState("");
  const [newSharedWith, setNewSharedWith] = useState<string[]>([]);

  // Add maintenance form
  const [maintType, setMaintType] = useState("");
  const [maintDate, setMaintDate] = useState(new Date().toISOString().split("T")[0]);
  const [maintMileage, setMaintMileage] = useState("");
  const [maintNextMileage, setMaintNextMileage] = useState("");
  const [maintNextDate, setMaintNextDate] = useState("");
  const [maintNotes, setMaintNotes] = useState("");
  const [oilWithFilter, setOilWithFilter] = useState(false);

  // Syncing handled by React Query

  const filteredManufacturers = useMemo(() => {
    const search = manufacturerSearch.toLowerCase().trim();
    const list = !search
      ? CAR_BRANDS
      : CAR_BRANDS.filter((b) =>
          b.name.toLowerCase().includes(search) || b.slug.includes(search)
        );
    // Always keep manual "other" option at the end
    return list;
  }, [manufacturerSearch]);

  const resetAddForm = () => {
    setNewManufacturer(""); setNewModel(""); setNewYear("");
    setNewMileage(""); setNewMileageUnit("km"); setNewColor(""); setNewPlate("");
    setManufacturerSearch(""); setNewSharedWith([]);
  };

  const resetMaintForm = () => {
    setMaintType(""); setMaintDate(new Date().toISOString().split("T")[0]);
    setMaintMileage(""); setMaintNextMileage(""); setMaintNextDate("");
    setMaintNotes(""); setOilWithFilter(false); setEditMaintenanceRecord(null);
  };

  const maxYear = new Date().getFullYear() + 1;

  const handleAddCar = () => {
    if (!newManufacturer || !newModel || !newYear) {
      appToast.error("يرجى تعبئة الحقول المطلوبة");
      return;
    }
    const yearNum = Number(newYear);
    if (yearNum < 1900 || yearNum > maxYear) {
      appToast.error(`السنة يجب أن تكون بين 1900 و ${maxYear}`);
      return;
    }
    if (newMileage && Number(newMileage) < 0) {
      appToast.error("الممشى يجب أن يكون أكبر من 0");
      return;
    }
    addVehicleMut.mutate({
      manufacturer: newManufacturer,
      model: newModel,
      year: newYear,
      mileage: Number(newMileage) || 0,
      mileage_unit: newMileageUnit,
      color: newColor,
      plate_number: newPlate,
      shared_with: newSharedWith,
    });
    setAddCarOpen(false);
    resetAddForm();
    appToast.success("تمت إضافة المركبة بنجاح");
  };

  const openEditCar = (car: CarData) => {
    setEditingCar(car);
    setNewManufacturer(car.manufacturer);
    setNewModel(car.model);
    setNewYear(car.year);
    setNewMileage(String(car.mileage));
    setNewMileageUnit(car.mileageUnit);
    setNewColor(car.color || "");
    setNewPlate(car.plateNumber || "");
    setNewSharedWith(car.sharedWith);
    setManufacturerSearch("");
    setEditCarOpen(true);
  };

  const handleEditCar = () => {
    if (!editingCar || !newManufacturer || !newModel || !newYear) {
      appToast.error("يرجى تعبئة الحقول المطلوبة");
      return;
    }
    const yearNum = Number(newYear);
    if (yearNum < 1900 || yearNum > maxYear) {
      appToast.error(`السنة يجب أن تكون بين 1900 و ${maxYear}`);
      return;
    }
    updateVehicleMut.mutate({
      id: editingCar.id,
      manufacturer: newManufacturer,
      model: newModel,
      year: newYear,
      mileage: Number(newMileage) || 0,
      mileage_unit: newMileageUnit,
      color: newColor,
      plate_number: newPlate,
      shared_with: newSharedWith,
    });
    setEditCarOpen(false);
    setEditingCar(null);
    resetAddForm();
    appToast.success("تم تعديل المركبة بنجاح");
  };

  const handleDeleteCar = (car: CarData) => {
    const carInfo = { name: getBrandName(car.manufacturer) };
    // Add to trash with all maintenance records
    addToTrash({
      type: "vehicle" as any,
      title: `${carInfo.name} ${car.model} ${car.year}`,
      description: `${car.mileage.toLocaleString()} ${car.mileageUnit === "km" ? "كم" : "ميل"} • لوحة: ${car.plateNumber || "—"}`,
      deletedBy: "",
      isShared: car.sharedWith.length > 0,
      originalData: car,
      relatedRecords: car.maintenance,
    });
    deleteVehicleMut.mutate(car.id);
    if (selectedCar?.id === car.id) setSelectedCar(null);
    setDeleteConfirmCar(null);
    appToast.success("تم نقل المركبة إلى سلة المحذوفات");
  };

  const handleAddMaintenance = () => {
    if (!selectedCar || !maintType) return;
    const typeInfo = MAINTENANCE_TYPES.find(t => t.id === maintType);

    const mainRecord = {
      vehicle_id: selectedCar.id,
      type: maintType,
      label: typeInfo?.label || maintType,
      date: maintDate,
      mileage_at_service: Number(maintMileage) || selectedCar.mileage,
      next_mileage: Number(maintNextMileage) || 0,
      next_date: maintNextDate,
      notes: maintNotes,
    };

    if (editMaintenanceRecord) {
      updateMaintMut.mutate({ id: editMaintenanceRecord.id, ...mainRecord });
    } else {
      addMaintMut.mutate(mainRecord);
      if (maintType === "oil_change" && oilWithFilter) {
        addMaintMut.mutate({
          ...mainRecord,
          type: "oil_filter",
          label: "فلتر الزيت",
          notes: "تم التغيير مع الزيت",
        });
      }
    }

    if (Number(maintMileage) > selectedCar.mileage) {
      updateVehicleMut.mutate({ id: selectedCar.id, mileage: Number(maintMileage) });
    }

    // optimistic update — keep user on the vehicle detail page
    if (!editMaintenanceRecord) {
      const optimisticRecord: MaintenanceRecord = {
        id: crypto.randomUUID(),
        type: maintType,
        label: mainRecord.label,
        date: maintDate,
        mileageAtService: Number(maintMileage) || 0,
        nextMileage: Number(maintNextMileage) || 0,
        nextDate: maintNextDate,
        notes: maintNotes || undefined,
      };
      setSelectedCar(prev => prev ? { ...prev, maintenance: [optimisticRecord, ...prev.maintenance] } : null);
    } else {
      setSelectedCar(prev => prev ? {
        ...prev,
        maintenance: prev.maintenance.map(m => m.id === editMaintenanceRecord.id ? { ...m, ...mainRecord, mileageAtService: Number(maintMileage) || 0, nextMileage: Number(maintNextMileage) || 0 } : m)
      } : null);
    }
    setAddMaintenanceOpen(false);
    resetMaintForm();
    appToast.success(editMaintenanceRecord ? "تم تعديل السجل" : "تمت إضافة سجل الصيانة");
  };

  const handleDeleteMaintenance = (recordId: string) => {
    if (!selectedCar) return;
    deleteMaintMut.mutate(recordId);
    setSelectedCar(prev => prev ? { ...prev, maintenance: prev.maintenance.filter(m => m.id !== recordId) } : null);
    appToast.success("تم حذف السجل");
  };

  const handleEditMaintenance = (record: MaintenanceRecord) => {
    setEditMaintenanceRecord(record);
    setMaintType(record.type);
    setMaintDate(record.date);
    setMaintMileage(record.mileageAtService.toString());
    setMaintNextMileage(record.nextMileage.toString());
    setMaintNextDate(record.nextDate);
    setMaintNotes(record.notes || "");
    setAddMaintenanceOpen(true);
  };

  const handleSetReminder = (record: MaintenanceRecord) => {
    appToast.success(`سيتم تذكيرك بـ ${record.label} عند ${record.nextMileage > 0 ? `${record.nextMileage.toLocaleString()} ${selectedCar?.mileageUnit === "km" ? "كم" : "ميل"}` : record.nextDate}`);
  };

  const handleShareCar = (car: CarData) => {
    setShareWith([...car.sharedWith]);
    setShareDrawerOpen(true);
  };

  const handleSaveShare = () => {
    if (!selectedCar) return;
    updateVehicleMut.mutate({ id: selectedCar.id, shared_with: shareWith });
    setSelectedCar(prev => prev ? { ...prev, sharedWith: shareWith } : null);
    setShareDrawerOpen(false);
    appToast.success("تم تحديث المشاركة");
  };

  const toggleShareMember = (memberId: string) => {
    setShareWith(prev =>
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    );
  };

  const getMaintenanceStatus = (record: MaintenanceRecord, car: CarData) => {
    const now = new Date();
    const nextDate = record.nextDate ? new Date(record.nextDate) : null;
    const daysUntil = nextDate ? Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
    const mileageRemaining = record.nextMileage > 0 ? record.nextMileage - car.mileage : null;

    if ((daysUntil !== null && daysUntil < 0) || (mileageRemaining !== null && mileageRemaining < 0)) {
      return { status: "overdue", label: "متأخر", color: "hsl(0 70% 50%)", bgColor: "hsl(0 70% 95%)" };
    }
    if ((daysUntil !== null && daysUntil <= 14) || (mileageRemaining !== null && mileageRemaining <= 500)) {
      return { status: "soon", label: "قريباً", color: "hsl(35 85% 45%)", bgColor: "hsl(35 85% 93%)" };
    }
    return { status: "ok", label: "جيد", color: "hsl(145 50% 38%)", bgColor: "hsl(145 50% 93%)" };
  };

  const currentYears = Array.from({ length: 35 }, (_, i) => (new Date().getFullYear() - i).toString());

  const vehicleQueryClient = useQueryClient();
  const handleRefresh = async () => {
    await vehicleQueryClient.invalidateQueries({ queryKey: ["vehicles"] });
  };

  // ─── Car Detail View ───
  if (selectedCar) {
    const carInfo = { name: getBrandName(selectedCar.manufacturer) };
    const lastMaintenance = selectedCar.maintenance.length > 0 ? selectedCar.maintenance[0] : null;
    const lastMileage = lastMaintenance ? lastMaintenance.mileageAtService : selectedCar.mileage;
    return (
      <div className="min-h-screen bg-background pb-24">
        <PageHeader
          title={`${carInfo.name} ${selectedCar.model}`}
          onBack={() => setSelectedCar(null)}
          actions={[
            {
              icon: <Share2 size={18} className="text-white" />,
              onClick: () => handleShareCar(selectedCar),
            },
          ]}
        >
          <div className="flex items-center gap-3 mt-3 pb-1">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
              <CarLogo manufacturer={selectedCar.manufacturer} size={36} />
            </div>
            <div className="flex-1 min-w-0 flex flex-wrap gap-x-4 gap-y-1 items-center text-white/80 text-xs">
              <div className="flex items-center gap-1">
                <Calendar size={12} />
                <span>{selectedCar.year}</span>
              </div>
              <div className="flex items-center gap-1">
                <Gauge size={12} />
                <span>{lastMileage.toLocaleString()} {selectedCar.mileageUnit === "km" ? "كم" : "ميل"}</span>
              </div>
              {selectedCar.plateNumber && (
                <div className="flex items-center gap-1">
                  <Car size={12} />
                  <span>{selectedCar.plateNumber}</span>
                </div>
              )}
            </div>
          </div>
        </PageHeader>

        {/* Shared With */}
        {selectedCar.sharedWith.length > 0 && (
          <div className="px-4 mt-4">
            <div className="rounded-2xl bg-card border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <div />
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-foreground">مشاركة مع</h4>
                  <Users size={16} className="text-primary" />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                {selectedCar.sharedWith.map(memberId => {
                  const member = familyMembers.find(m => m.id === memberId);
                  return (
                    <div key={memberId} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10">
                      <span className="text-xs font-medium text-primary">{member?.name || "غير معروف"}</span>
                      <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary">
                        {member?.name?.charAt(0) || "؟"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Maintenance List */}
        <div className="px-4 mt-6" dir="rtl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-foreground">سجل الصيانة</h3>
            <div />
          </div>

          {selectedCar.maintenance.length === 0 ? (
            <div className="text-center py-12">
              <Wrench size={40} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground text-sm">لا توجد سجلات صيانة بعد</p>
              <p className="text-muted-foreground/60 text-xs mt-1">اضغط + لإضافة أول سجل</p>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedCar.maintenance.map((record) => {
                const typeInfo = MAINTENANCE_TYPES.find(t => t.id === record.type);
                const status = getMaintenanceStatus(record, selectedCar);
                const Icon = typeInfo?.icon || Wrench;

                return (
                  <SwipeableCard
                    key={record.id}
                    onSwipeOpen={() => setOpenCardId(record.id)}
                    actions={[
                      { icon: <Bell size={16} />, label: "تذكير", color: "bg-amber-500", onClick: () => handleSetReminder(record) },
                      { icon: <Pencil size={16} />, label: "تعديل", color: "bg-primary", onClick: () => handleEditMaintenance(record) },
                      { icon: <Trash2 size={16} />, label: "حذف", color: "bg-destructive", onClick: () => handleDeleteMaintenance(record.id) },
                    ]}
                  >
                    <div className="bg-card rounded-2xl p-4 border border-border" dir="rtl">
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: typeInfo?.color + "20" }}>
                          <Icon size={20} style={{ color: typeInfo?.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-sm text-foreground">{record.label}</h4>
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-full border-0"
                              style={{ background: status.bgColor, color: status.color }}>
                              {status.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(record.date).toLocaleDateString("ar-SA")} • {record.mileageAtService.toLocaleString()} {selectedCar.mileageUnit === "km" ? "كم" : "ميل"}
                          </p>
                          {(record.nextMileage > 0 || record.nextDate) && (
                            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground/70">
                              <AlertTriangle size={12} />
                              <span>
                                التغيير القادم: {record.nextMileage > 0 && `${record.nextMileage.toLocaleString()} ${selectedCar.mileageUnit === "km" ? "كم" : "ميل"}`}
                                {record.nextMileage > 0 && record.nextDate && " أو "}
                                {record.nextDate && new Date(record.nextDate).toLocaleDateString("ar-SA")}
                              </span>
                            </div>
                          )}
                          {record.notes && (
                            <p className="text-xs text-muted-foreground/60 mt-1">{record.notes}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </SwipeableCard>
                );
              })}
            </div>
          )}
        </div>

        <FAB onClick={() => { resetMaintForm(); setAddMaintenanceOpen(true); }} />

        {/* Add/Edit Maintenance Drawer */}
        <Drawer open={addMaintenanceOpen} onOpenChange={setAddMaintenanceOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{editMaintenanceRecord ? "تعديل سجل الصيانة" : "إضافة سجل صيانة"}</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4 space-y-4 flex-1 overflow-y-auto">
              <div className="space-y-2">
                <Label className="text-right block">نوع الصيانة</Label>
                <div className="grid grid-cols-3 gap-2">
                  {MAINTENANCE_TYPES.map(type => (
                    <button
                      key={type.id}
                      onClick={() => setMaintType(type.id)}
                      className={`p-2.5 rounded-xl border text-center transition-all ${maintType === type.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border bg-card"
                        }`}
                    >
                      <type.icon size={18} className="mx-auto mb-1" style={{ color: type.color }} />
                      <span className="text-[10px] font-medium text-foreground">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {maintType === "oil_change" && (
                <div className="flex items-center justify-between bg-card rounded-xl p-3 border border-border">
                  <Switch checked={oilWithFilter} onCheckedChange={setOilWithFilter} />
                  <Label className="text-sm">مع فلتر زيت</Label>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-right block">تاريخ الصيانة</Label>
                <Input type="date" value={maintDate} onChange={e => setMaintDate(e.target.value)} className="text-right" />
              </div>

              <div className="space-y-2">
                <Label className="text-right block">الممشى عند الصيانة ({selectedCar.mileageUnit === "km" ? "كم" : "ميل"})</Label>
                <Input type="text" inputMode="numeric" pattern="\d*" value={maintMileage} onChange={e => setMaintMileage(e.target.value)}
                  placeholder={selectedCar.mileage.toLocaleString()} className="text-right" />
              </div>

              <div className="space-y-2">
                <Label className="text-right block">التغيير القادم عند ({selectedCar.mileageUnit === "km" ? "كم" : "ميل"})</Label>
                <Input type="text" inputMode="numeric" pattern="\d*" value={maintNextMileage} onChange={e => setMaintNextMileage(e.target.value)}
                  placeholder="مثال: 50000" className="text-right" />
              </div>

              <div className="space-y-2">
                <Label className="text-right block">أو التغيير القادم بتاريخ</Label>
                <Input type="date" value={maintNextDate} onChange={e => setMaintNextDate(e.target.value)} className="text-right" />
              </div>

              <div className="space-y-2">
                <Label className="text-right block">ملاحظات (اختياري)</Label>
                <Input value={maintNotes} onChange={e => setMaintNotes(e.target.value)}
                  placeholder="مثلاً: زيت موبيل 5W-30" className="text-right" />
              </div>
            </div>
            <DrawerFooter>
              <Button onClick={handleAddMaintenance} disabled={!maintType} className="w-full rounded-xl h-12">
                {editMaintenanceRecord ? "حفظ التعديلات" : "إضافة"}
              </Button>
              <DrawerClose asChild>
                <Button variant="outline" className="w-full rounded-xl">إلغاء</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        {/* Share Drawer */}
        <Drawer open={shareDrawerOpen} onOpenChange={setShareDrawerOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle className="text-right">مشاركة المركبة</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4 space-y-4" dir="rtl">
              <p className="text-sm text-muted-foreground">اختر أفراد الأسرة أو السائق لمشاركة المركبة معهم</p>
              {familyMembers.filter(m => m.id !== "creator").length === 0 ? (
                <div className="text-center py-8">
                  <Users size={32} className="mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-muted-foreground text-sm">لا يوجد أفراد أسرة</p>
                  <p className="text-muted-foreground/60 text-xs mt-1">أضف أفراد الأسرة من صفحة إدارة الأسرة</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {familyMembers.filter(m => m.id !== "creator").map(member => {
                    const isSelected = shareWith.includes(member.id);
                    return (
                      <button
                        key={member.id}
                        onClick={() => toggleShareMember(member.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          isSelected ? "border-primary bg-primary/5" : "border-border bg-card"
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                          isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}>
                          {member.name.charAt(0)}
                        </div>
                        <div className="flex-1 text-right">
                          <p className="font-medium text-sm text-foreground">{member.name}</p>
                          <p className="text-xs text-muted-foreground">{member.role}</p>
                        </div>
                        {isSelected && <Check size={18} className="text-primary" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <DrawerFooter>
              <Button onClick={handleSaveShare} className="w-full rounded-xl">حفظ</Button>
              <DrawerClose asChild>
                <Button variant="outline" className="w-full rounded-xl">إلغاء</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    );
  }

  // ─── Cars List View ───
  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHeader title="مركباتي" subtitle={cars.length > 0 ? `${cars.length} مركبة` : undefined} />
      {vehiclesLoading ? (
        <div className="px-4 py-4 space-y-3">
          <div className="flex gap-3">
            <div className="h-20 flex-1 rounded-2xl bg-muted animate-pulse" />
            <div className="h-20 flex-1 rounded-2xl bg-muted animate-pulse" />
          </div>
          <div className="h-10 rounded-xl bg-muted animate-pulse" />
          <div className="space-y-3 pt-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      ) : (
      <PullToRefresh onRefresh={handleRefresh}>

        {/* Cars */}
        <div className="px-4 pt-5">
          {cars.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Car size={36} className="text-muted-foreground/40" />
              </div>
              <h3 className="text-foreground font-bold mb-1">لا توجد مركبات</h3>
              <p className="text-muted-foreground text-sm">أضف مركبتك الأولى لتتبع صيانتها</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cars.map(car => {
                const carInfo = { name: getBrandName(car.manufacturer) };
                const overdueCount = car.maintenance.filter(m => getMaintenanceStatus(m, car).status === "overdue").length;
                const soonCount = car.maintenance.filter(m => getMaintenanceStatus(m, car).status === "soon").length;

                return (
                  <SwipeableCard
                    key={car.id}
                    onSwipeOpen={() => setOpenCardId(car.id)}
                    actions={[
                      { icon: <Pencil size={16} />, label: "تعديل", color: "bg-primary", onClick: () => openEditCar(car) },
                      { icon: <Trash2 size={16} />, label: "حذف", color: "bg-destructive", onClick: () => setDeleteConfirmCar(car) },
                    ]}
                  >
                    <button
                      onClick={() => setSelectedCar(car)}
                      className="w-full bg-card rounded-2xl p-4 border border-border text-right"
                    >
                      <div className="flex items-center gap-3">
                        <ChevronLeft size={16} className="text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-foreground">
                            {carInfo.name} {car.model}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {car.year} • {car.mileage.toLocaleString()} {car.mileageUnit === "km" ? "كم" : "ميل"}
                            {car.sharedWith.length > 0 && (
                              <span className="inline-flex items-center gap-1 mr-2">
                                <Users size={10} className="inline" />
                                {car.sharedWith.length}
                              </span>
                            )}
                          </p>
                          {(overdueCount > 0 || soonCount > 0) && (
                            <div className="flex items-center gap-2 mt-2">
                              {overdueCount > 0 && (
                                <Badge variant="outline" className="text-[10px] border-0 px-2 py-0.5 rounded-full"
                                  style={{ background: "hsl(0 70% 95%)", color: "hsl(0 70% 50%)" }}>
                                  {overdueCount} متأخر
                                </Badge>
                              )}
                              {soonCount > 0 && (
                                <Badge variant="outline" className="text-[10px] border-0 px-2 py-0.5 rounded-full"
                                  style={{ background: "hsl(35 85% 93%)", color: "hsl(35 85% 45%)" }}>
                                  {soonCount} قريباً
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
                          <CarLogo manufacturer={car.manufacturer} size={40} />
                        </div>
                      </div>
                    </button>
                  </SwipeableCard>
                );
              })}
            </div>
          )}
        </div>

        <FAB onClick={() => { resetAddForm(); setAddCarOpen(true); }} />

        {/* Add Car Drawer */}
        <Drawer open={addCarOpen} onOpenChange={(open) => { setAddCarOpen(open); if (!open) setManufacturerSearch(""); }}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>إضافة مركبة جديدة</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4 space-y-4 flex-1 overflow-y-auto">
              {/* Manufacturer with search */}
              <div className="space-y-2">
                <Label className="text-right block">الشركة المصنعة *</Label>
                <div className="relative mb-2">
                  <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={manufacturerSearch}
                    onChange={e => setManufacturerSearch(e.target.value)}
                    placeholder="ابحث عن الشركة..."
                    className="text-right pr-9"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {filteredManufacturers.map((b) => (
                    <button
                      key={b.slug}
                      onClick={() => { setNewManufacturer(b.slug); setManufacturerSearch(""); }}
                      className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                        newManufacturer === b.slug
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border bg-card"
                      }`}
                    >
                      <div className="w-8 h-8 flex items-center justify-center">
                        <CarLogo manufacturer={b.slug} size={28} />
                      </div>
                      <span className="text-[10px] font-medium text-foreground leading-tight">{b.name}</span>
                    </button>
                  ))}
                  {filteredManufacturers.length === 0 && (
                    <p className="col-span-3 text-center text-muted-foreground text-sm py-4">لا توجد نتائج</p>
                  )}
                </div>
              </div>

              {/* Model & Year */}
              <div className="flex gap-3">
                <div className="space-y-2 flex-1">
                  <Label className="text-right block">الموديل *</Label>
                  <Input value={newModel} onChange={e => setNewModel(e.target.value)}
                    placeholder="مثال: Camry, Accord" className="text-right" />
                </div>
                <div className="space-y-2 w-28 shrink-0">
                  <Label className="text-right block">السنة *</Label>
                  <Input type="text" inputMode="numeric" pattern="\d*" value={newYear} onChange={e => setNewYear(e.target.value)}
                    placeholder="2024" className="text-right" />
                </div>
              </div>

              {/* Mileage */}
              <div className="space-y-2">
                <Label className="text-right block">الممشى (اختياري)</Label>
                <div className="flex gap-3">
                  <Input type="text" inputMode="numeric" pattern="\d*" value={newMileage} onChange={e => setNewMileage(e.target.value)}
                    placeholder="0" className="text-right flex-1" />
                  <Select value={newMileageUnit} onValueChange={v => setNewMileageUnit(v as "km" | "mi")}>
                    <SelectTrigger className="w-28 shrink-0 text-right" dir="rtl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="km">كم</SelectItem>
                      <SelectItem value="mi">ميل</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Plate */}
              <div className="space-y-2">
                <Label className="text-right block">رقم اللوحة (اختياري)</Label>
                <Input value={newPlate} onChange={e => setNewPlate(e.target.value)}
                  placeholder="مثال: ABC 1234" className="text-right" />
              </div>

              {/* Share with family */}
              <div className="space-y-2">
                <Label className="text-right block flex items-center gap-2 flex-row-reverse justify-start">
                  <Users size={14} className="text-muted-foreground" />
                  <span>مشاركة مع</span>
                </Label>
                {familyMembers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-right">
                    لا يوجد أفراد مضافون بعد. أضف أفراد الأسرة من إدارة العائلة.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2 justify-end">
                    {familyMembers.filter(m => m.id !== "creator").map(member => {
                      const isSelected = newSharedWith.includes(member.id);
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => {
                            setNewSharedWith(prev =>
                              isSelected ? prev.filter(id => id !== member.id) : [...prev, member.id]
                            );
                          }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all flex-row-reverse ${
                            isSelected
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-card text-foreground"
                          }`}
                        >
                          {isSelected && <Check size={14} />}
                          <span>{member.name}</span>
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                            {member.name?.charAt(0) || "؟"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <DrawerFooter>
              <Button onClick={handleAddCar} disabled={!newManufacturer || !newModel || !newYear}
                className="w-full rounded-xl h-12">
                إضافة المركبة
              </Button>
              <DrawerClose asChild>
                <Button variant="outline" className="w-full rounded-xl">إلغاء</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        {/* Edit Car Drawer */}
        <Drawer open={editCarOpen} onOpenChange={(open) => { setEditCarOpen(open); if (!open) { setEditingCar(null); resetAddForm(); } }}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>تعديل المركبة</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4 space-y-4 flex-1 overflow-y-auto">
              {/* Manufacturer with search */}
              <div className="space-y-2">
                <Label className="text-right block">الشركة المصنعة *</Label>
                <div className="relative mb-2">
                  <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={manufacturerSearch}
                    onChange={e => setManufacturerSearch(e.target.value)}
                    placeholder="ابحث عن الشركة..."
                    className="text-right pr-9"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {filteredManufacturers.map((b) => (
                    <button
                      key={b.slug}
                      onClick={() => { setNewManufacturer(b.slug); setManufacturerSearch(""); }}
                      className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                        newManufacturer === b.slug
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border bg-card"
                      }`}
                    >
                      <div className="w-8 h-8 flex items-center justify-center">
                        <CarLogo manufacturer={b.slug} size={28} />
                      </div>
                      <span className="text-[10px] font-medium text-foreground leading-tight">{b.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Model & Year */}
              <div className="flex gap-3">
                <div className="space-y-2 flex-1">
                  <Label className="text-right block">الموديل *</Label>
                  <Input value={newModel} onChange={e => setNewModel(e.target.value)}
                    placeholder="مثال: Camry, Accord" className="text-right" />
                </div>
                <div className="space-y-2 w-28 shrink-0">
                  <Label className="text-right block">السنة *</Label>
                  <Input type="text" inputMode="numeric" pattern="\d*" value={newYear} onChange={e => setNewYear(e.target.value)}
                    placeholder="2024" className="text-right" />
                </div>
              </div>

              {/* Mileage */}
              <div className="space-y-2">
                <Label className="text-right block">الممشى</Label>
                <div className="flex gap-3">
                  <Input type="text" inputMode="numeric" pattern="\d*" value={newMileage} onChange={e => setNewMileage(e.target.value)}
                    placeholder="0" className="text-right flex-1" />
                  <Select value={newMileageUnit} onValueChange={v => setNewMileageUnit(v as "km" | "mi")}>
                    <SelectTrigger className="w-28 shrink-0 text-right" dir="rtl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="km">كم</SelectItem>
                      <SelectItem value="mi">ميل</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Plate */}
              <div className="space-y-2">
                <Label className="text-right block">رقم اللوحة</Label>
                <Input value={newPlate} onChange={e => setNewPlate(e.target.value)}
                  placeholder="مثال: ABC 1234" className="text-right" />
              </div>

              {/* Share with family */}
              <div className="space-y-2">
                <Label className="text-right block flex items-center gap-2 flex-row-reverse justify-start">
                  <Users size={14} className="text-muted-foreground" />
                  <span>مشاركة مع</span>
                </Label>
                {familyMembers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-right">لا يوجد أفراد</p>
                ) : (
                  <div className="flex flex-wrap gap-2 justify-end">
                    {familyMembers.filter(m => m.id !== "creator").map(member => {
                      const isSelected = newSharedWith.includes(member.id);
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => {
                            setNewSharedWith(prev =>
                              isSelected ? prev.filter(id => id !== member.id) : [...prev, member.id]
                            );
                          }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all flex-row-reverse ${
                            isSelected
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-card text-foreground"
                          }`}
                        >
                          {isSelected && <Check size={14} />}
                          <span>{member.name}</span>
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                            {member.name?.charAt(0) || "؟"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <DrawerFooter>
              <Button onClick={handleEditCar} disabled={!newManufacturer || !newModel || !newYear}
                className="w-full rounded-xl h-12">
                حفظ التعديلات
              </Button>
              <DrawerClose asChild>
                <Button variant="outline" className="w-full rounded-xl">إلغاء</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        <Drawer open={!!deleteConfirmCar} onOpenChange={() => setDeleteConfirmCar(null)}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>حذف المركبة</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4 text-center space-y-3" dir="rtl">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <Trash2 size={28} className="text-destructive" />
              </div>
              {deleteConfirmCar && (
                <>
                  <p className="font-bold text-foreground">
                    {getBrandName(deleteConfirmCar.manufacturer)} {deleteConfirmCar.model}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    سيتم نقل المركبة مع كل سجلات صيانتها ({deleteConfirmCar.maintenance.length} سجل) إلى سلة المحذوفات
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    يمكنك استعادتها خلال 30 يوماً من سلة المحذوفات
                  </p>
                </>
              )}
            </div>
            <DrawerFooter>
              <Button variant="destructive" onClick={() => deleteConfirmCar && handleDeleteCar(deleteConfirmCar)} className="w-full rounded-xl h-12">
                حذف المركبة
              </Button>
              <DrawerClose asChild>
                <Button variant="outline" className="w-full rounded-xl">إلغاء</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </PullToRefresh>
      )}
    </div>
  );
};

export default Vehicle;
