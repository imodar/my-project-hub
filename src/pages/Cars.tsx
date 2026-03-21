import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Plus, Car, Gauge, Fuel, Calendar, Wrench, ChevronLeft, Share2, Trash2, Bell, Pencil, MoreVertical, Check, X, Filter, Droplets, Wind, Disc3, Zap, Sparkles, CircleDot, Settings2, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { toast } from "sonner";

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

// ─── Constants ───
const CAR_MANUFACTURERS: Record<string, { name: string; logo: string }> = {
  toyota: { name: "Toyota", logo: "🚗" },
  honda: { name: "Honda", logo: "🏎️" },
  nissan: { name: "Nissan", logo: "🚙" },
  hyundai: { name: "Hyundai", logo: "🚘" },
  kia: { name: "Kia", logo: "🚕" },
  bmw: { name: "BMW", logo: "🏁" },
  mercedes: { name: "Mercedes-Benz", logo: "⭐" },
  audi: { name: "Audi", logo: "💎" },
  lexus: { name: "Lexus", logo: "✨" },
  ford: { name: "Ford", logo: "🔵" },
  chevrolet: { name: "Chevrolet", logo: "🟡" },
  volkswagen: { name: "Volkswagen", logo: "🔷" },
  mazda: { name: "Mazda", logo: "🔴" },
  subaru: { name: "Subaru", logo: "⭐" },
  porsche: { name: "Porsche", logo: "🏆" },
  landrover: { name: "Land Rover", logo: "🌲" },
  jeep: { name: "Jeep", logo: "⛰️" },
  gmc: { name: "GMC", logo: "🛻" },
  dodge: { name: "Dodge", logo: "🐏" },
  mitsubishi: { name: "Mitsubishi", logo: "🔺" },
  other: { name: "أخرى", logo: "🚗" },
};

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

const STORAGE_KEY = "family-cars";

const loadCars = (): CarData[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch { return []; }
};

const saveCars = (cars: CarData[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cars));
};

// ─── Swipeable Row ───
const SwipeableRow = ({ children, onDelete, onEdit, onReminder }: {
  children: React.ReactNode;
  onDelete: () => void;
  onEdit: () => void;
  onReminder: () => void;
}) => {
  const [offset, setOffset] = useState(0);
  const constraintsRef = useRef<HTMLDivElement>(null);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x > 120) {
      onDelete();
      setOffset(0);
    } else if (info.offset.x < -120) {
      setOffset(0);
    } else {
      setOffset(0);
    }
  };

  return (
    <div ref={constraintsRef} className="relative overflow-hidden rounded-2xl">
      {/* Actions behind */}
      <div className="absolute inset-0 flex items-stretch">
        <div className="flex items-center gap-2 px-3 bg-destructive text-destructive-foreground">
          <Trash2 size={18} />
          <span className="text-xs font-bold">حذف</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1 px-2">
          <button onClick={onReminder} className="p-2 rounded-xl bg-amber-100 text-amber-700">
            <Bell size={16} />
          </button>
          <button onClick={onEdit} className="p-2 rounded-xl bg-blue-100 text-blue-700">
            <Pencil size={16} />
          </button>
        </div>
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -140, right: 140 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        animate={{ x: offset }}
        className="relative z-10"
      >
        {children}
      </motion.div>
    </div>
  );
};

// ─── Main Component ───
const Cars = () => {
  const navigate = useNavigate();
  const [cars, setCars] = useState<CarData[]>(loadCars);
  const [selectedCar, setSelectedCar] = useState<CarData | null>(null);
  const [addCarOpen, setAddCarOpen] = useState(false);
  const [addMaintenanceOpen, setAddMaintenanceOpen] = useState(false);
  const [editMaintenanceRecord, setEditMaintenanceRecord] = useState<MaintenanceRecord | null>(null);

  // Add car form
  const [newManufacturer, setNewManufacturer] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newYear, setNewYear] = useState("");
  const [newMileage, setNewMileage] = useState("");
  const [newMileageUnit, setNewMileageUnit] = useState<"km" | "mi">("km");
  const [newColor, setNewColor] = useState("");
  const [newPlate, setNewPlate] = useState("");

  // Add maintenance form
  const [maintType, setMaintType] = useState("");
  const [maintDate, setMaintDate] = useState(new Date().toISOString().split("T")[0]);
  const [maintMileage, setMaintMileage] = useState("");
  const [maintNextMileage, setMaintNextMileage] = useState("");
  const [maintNextDate, setMaintNextDate] = useState("");
  const [maintNotes, setMaintNotes] = useState("");
  const [oilWithFilter, setOilWithFilter] = useState(false);

  useEffect(() => { saveCars(cars); }, [cars]);

  const resetAddForm = () => {
    setNewManufacturer(""); setNewModel(""); setNewYear("");
    setNewMileage(""); setNewMileageUnit("km"); setNewColor(""); setNewPlate("");
  };

  const resetMaintForm = () => {
    setMaintType(""); setMaintDate(new Date().toISOString().split("T")[0]);
    setMaintMileage(""); setMaintNextMileage(""); setMaintNextDate("");
    setMaintNotes(""); setOilWithFilter(false); setEditMaintenanceRecord(null);
  };

  const handleAddCar = () => {
    if (!newManufacturer || !newModel || !newYear) {
      toast.error("يرجى تعبئة الحقول المطلوبة");
      return;
    }
    const car: CarData = {
      id: Date.now().toString(),
      manufacturer: newManufacturer,
      model: newModel,
      year: newYear,
      mileage: Number(newMileage) || 0,
      mileageUnit: newMileageUnit,
      color: newColor,
      plateNumber: newPlate,
      sharedWith: [],
      maintenance: [],
      createdAt: new Date().toISOString(),
    };
    setCars(prev => [car, ...prev]);
    setAddCarOpen(false);
    resetAddForm();
    toast.success("تمت إضافة السيارة بنجاح");
  };

  const handleDeleteCar = (carId: string) => {
    setCars(prev => prev.filter(c => c.id !== carId));
    if (selectedCar?.id === carId) setSelectedCar(null);
    toast.success("تم حذف السيارة");
  };

  const handleAddMaintenance = () => {
    if (!selectedCar || !maintType) return;
    const typeInfo = MAINTENANCE_TYPES.find(t => t.id === maintType);

    const records: MaintenanceRecord[] = [];

    // Main record
    records.push({
      id: editMaintenanceRecord?.id || Date.now().toString(),
      type: maintType,
      label: typeInfo?.label || maintType,
      date: maintDate,
      mileageAtService: Number(maintMileage) || selectedCar.mileage,
      nextMileage: Number(maintNextMileage) || 0,
      nextDate: maintNextDate,
      notes: maintNotes,
    });

    // If oil change with filter, add filter record too
    if (maintType === "oil_change" && oilWithFilter) {
      records.push({
        id: (Date.now() + 1).toString(),
        type: "oil_filter",
        label: "فلتر الزيت",
        date: maintDate,
        mileageAtService: Number(maintMileage) || selectedCar.mileage,
        nextMileage: Number(maintNextMileage) || 0,
        nextDate: maintNextDate,
        notes: "تم التغيير مع الزيت",
      });
    }

    const updatedCar = { ...selectedCar };
    if (editMaintenanceRecord) {
      updatedCar.maintenance = updatedCar.maintenance.map(m =>
        m.id === editMaintenanceRecord.id ? records[0] : m
      );
    } else {
      updatedCar.maintenance = [...records, ...updatedCar.maintenance];
    }

    // Update mileage if provided
    if (Number(maintMileage) > selectedCar.mileage) {
      updatedCar.mileage = Number(maintMileage);
    }

    setCars(prev => prev.map(c => c.id === updatedCar.id ? updatedCar : c));
    setSelectedCar(updatedCar);
    setAddMaintenanceOpen(false);
    resetMaintForm();
    toast.success(editMaintenanceRecord ? "تم تعديل السجل" : "تمت إضافة سجل الصيانة");
  };

  const handleDeleteMaintenance = (recordId: string) => {
    if (!selectedCar) return;
    const updatedCar = {
      ...selectedCar,
      maintenance: selectedCar.maintenance.filter(m => m.id !== recordId),
    };
    setCars(prev => prev.map(c => c.id === updatedCar.id ? updatedCar : c));
    setSelectedCar(updatedCar);
    toast.success("تم حذف السجل");
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
    toast.success(`سيتم تذكيرك بـ ${record.label} عند ${record.nextMileage > 0 ? `${record.nextMileage.toLocaleString()} ${selectedCar?.mileageUnit === "km" ? "كم" : "ميل"}` : record.nextDate}`);
  };

  const handleShareCar = (car: CarData) => {
    if (navigator.share) {
      navigator.share({
        title: `${CAR_MANUFACTURERS[car.manufacturer]?.name || car.manufacturer} ${car.model}`,
        text: `سيارة ${CAR_MANUFACTURERS[car.manufacturer]?.name} ${car.model} - ${car.year}\nالممشى: ${car.mileage.toLocaleString()} ${car.mileageUnit === "km" ? "كم" : "ميل"}`,
      });
    } else {
      toast.info("المشاركة غير متاحة على هذا الجهاز");
    }
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

  // ─── Car Detail View ───
  if (selectedCar) {
    const carInfo = CAR_MANUFACTURERS[selectedCar.manufacturer] || CAR_MANUFACTURERS.other;
    return (
      <div className="min-h-screen bg-background max-w-2xl mx-auto pb-24">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border">
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={() => handleShareCar(selectedCar)} className="p-2 rounded-xl hover:bg-muted">
              <Share2 size={20} className="text-muted-foreground" />
            </button>
            <h1 className="text-lg font-bold text-foreground">
              {carInfo.name} {selectedCar.model}
            </h1>
            <button onClick={() => setSelectedCar(null)} className="p-2 rounded-xl hover:bg-muted">
              <ArrowRight size={20} className="text-foreground" />
            </button>
          </div>
        </div>

        {/* Car Card */}
        <div className="px-4 pt-5">
          <div className="rounded-3xl p-5 text-center" style={{
            background: "linear-gradient(135deg, hsl(var(--hero-gradient-from)), hsl(var(--hero-gradient-to)))"
          }}>
            <div className="text-5xl mb-3">{carInfo.logo}</div>
            <h2 className="text-xl font-bold text-white mb-1">
              {carInfo.name} {selectedCar.model}
            </h2>
            <p className="text-white/70 text-sm mb-4">{selectedCar.year}</p>

            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <div className="flex items-center gap-1 text-white/60 text-xs mb-1">
                  <Gauge size={14} />
                  <span>الممشى</span>
                </div>
                <p className="text-white font-bold text-lg">
                  {selectedCar.mileage.toLocaleString()}
                  <span className="text-xs text-white/60 mr-1">
                    {selectedCar.mileageUnit === "km" ? "كم" : "ميل"}
                  </span>
                </p>
              </div>
              {selectedCar.plateNumber && (
                <div className="text-center">
                  <div className="flex items-center gap-1 text-white/60 text-xs mb-1">
                    <Car size={14} />
                    <span>اللوحة</span>
                  </div>
                  <p className="text-white font-bold">{selectedCar.plateNumber}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Maintenance List */}
        <div className="px-4 mt-6">
          <div className="flex items-center justify-between mb-4">
            <div />
            <h3 className="text-base font-bold text-foreground">سجل الصيانة</h3>
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
                  <SwipeableRow
                    key={record.id}
                    onDelete={() => handleDeleteMaintenance(record.id)}
                    onEdit={() => handleEditMaintenance(record)}
                    onReminder={() => handleSetReminder(record)}
                  >
                    <div className="bg-card rounded-2xl p-4 border border-border">
                      <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: typeInfo?.color + "20" }}>
                          <Icon size={20} style={{ color: typeInfo?.color }} />
                        </div>
                        <div className="flex-1 min-w-0 text-right">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-full border-0"
                              style={{ background: status.bgColor, color: status.color }}>
                              {status.label}
                            </Badge>
                            <h4 className="font-bold text-sm text-foreground">{record.label}</h4>
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
                  </SwipeableRow>
                );
              })}
            </div>
          )}
        </div>

        {/* FAB */}
        <button
          onClick={() => { resetMaintForm(); setAddMaintenanceOpen(true); }}
          className="fixed bottom-24 left-5 z-40 w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center"
          style={{ background: "hsl(var(--primary))" }}
        >
          <Plus size={24} className="text-primary-foreground" />
        </button>

        {/* Add/Edit Maintenance Drawer */}
        <Drawer open={addMaintenanceOpen} onOpenChange={setAddMaintenanceOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>{editMaintenanceRecord ? "تعديل سجل الصيانة" : "إضافة سجل صيانة"}</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Type */}
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

              {/* Oil with filter option */}
              {maintType === "oil_change" && (
                <div className="flex items-center justify-between bg-card rounded-xl p-3 border border-border">
                  <Switch checked={oilWithFilter} onCheckedChange={setOilWithFilter} />
                  <Label className="text-sm">مع فلتر زيت</Label>
                </div>
              )}

              {/* Date */}
              <div className="space-y-2">
                <Label className="text-right block">تاريخ الصيانة</Label>
                <Input type="date" value={maintDate} onChange={e => setMaintDate(e.target.value)} className="text-right" />
              </div>

              {/* Mileage at service */}
              <div className="space-y-2">
                <Label className="text-right block">الممشى عند الصيانة ({selectedCar.mileageUnit === "km" ? "كم" : "ميل"})</Label>
                <Input type="number" value={maintMileage} onChange={e => setMaintMileage(e.target.value)}
                  placeholder={selectedCar.mileage.toLocaleString()} className="text-right" />
              </div>

              {/* Next mileage */}
              <div className="space-y-2">
                <Label className="text-right block">التغيير القادم عند ({selectedCar.mileageUnit === "km" ? "كم" : "ميل"})</Label>
                <Input type="number" value={maintNextMileage} onChange={e => setMaintNextMileage(e.target.value)}
                  placeholder="مثال: 50000" className="text-right" />
              </div>

              {/* Next date */}
              <div className="space-y-2">
                <Label className="text-right block">أو التغيير القادم بتاريخ</Label>
                <Input type="date" value={maintNextDate} onChange={e => setMaintNextDate(e.target.value)} className="text-right" />
              </div>

              {/* Notes */}
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
      </div>
    );
  }

  // ─── Cars List View ───
  return (
    <div className="min-h-screen bg-background max-w-2xl mx-auto pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="w-10" />
          <h1 className="text-lg font-bold text-foreground">سياراتي</h1>
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-muted">
            <ArrowRight size={20} className="text-foreground" />
          </button>
        </div>
      </div>

      {/* Cars */}
      <div className="px-4 pt-5">
        {cars.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Car size={36} className="text-muted-foreground/40" />
            </div>
            <h3 className="text-foreground font-bold mb-1">لا توجد سيارات</h3>
            <p className="text-muted-foreground text-sm">أضف سيارتك الأولى لتتبع صيانتها</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cars.map(car => {
              const carInfo = CAR_MANUFACTURERS[car.manufacturer] || CAR_MANUFACTURERS.other;
              const overdueCount = car.maintenance.filter(m => getMaintenanceStatus(m, car).status === "overdue").length;
              const soonCount = car.maintenance.filter(m => getMaintenanceStatus(m, car).status === "soon").length;

              return (
                <SwipeableRow
                  key={car.id}
                  onDelete={() => handleDeleteCar(car.id)}
                  onEdit={() => setSelectedCar(car)}
                  onReminder={() => {}}
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
                      <div className="text-4xl shrink-0">{carInfo.logo}</div>
                    </div>
                  </button>
                </SwipeableRow>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => { resetAddForm(); setAddCarOpen(true); }}
        className="fixed bottom-24 left-5 z-40 w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center"
        style={{ background: "hsl(var(--primary))" }}
      >
        <Plus size={24} className="text-primary-foreground" />
      </button>

      {/* Add Car Drawer */}
      <Drawer open={addCarOpen} onOpenChange={setAddCarOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>إضافة سيارة جديدة</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Manufacturer */}
            <div className="space-y-2">
              <Label className="text-right block">الشركة المصنعة *</Label>
              <Select value={newManufacturer} onValueChange={setNewManufacturer}>
                <SelectTrigger className="text-right">
                  <SelectValue placeholder="اختر الشركة" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CAR_MANUFACTURERS).map(([key, val]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <span>{val.logo}</span>
                        <span>{val.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model */}
            <div className="space-y-2">
              <Label className="text-right block">الموديل *</Label>
              <Input value={newModel} onChange={e => setNewModel(e.target.value)}
                placeholder="مثال: Camry, Accord" className="text-right" />
            </div>

            {/* Year */}
            <div className="space-y-2">
              <Label className="text-right block">سنة الصنع *</Label>
              <Select value={newYear} onValueChange={setNewYear}>
                <SelectTrigger className="text-right">
                  <SelectValue placeholder="اختر السنة" />
                </SelectTrigger>
                <SelectContent>
                  {currentYears.map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Mileage */}
            <div className="space-y-2">
              <Label className="text-right block">الممشى (اختياري)</Label>
              <div className="flex gap-2">
                <Select value={newMileageUnit} onValueChange={v => setNewMileageUnit(v as "km" | "mi")}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="km">كم</SelectItem>
                    <SelectItem value="mi">ميل</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" value={newMileage} onChange={e => setNewMileage(e.target.value)}
                  placeholder="0" className="text-right flex-1" />
              </div>
            </div>

            {/* Plate */}
            <div className="space-y-2">
              <Label className="text-right block">رقم اللوحة (اختياري)</Label>
              <Input value={newPlate} onChange={e => setNewPlate(e.target.value)}
                placeholder="مثال: ABC 1234" className="text-right" />
            </div>
          </div>
          <DrawerFooter>
            <Button onClick={handleAddCar} disabled={!newManufacturer || !newModel || !newYear}
              className="w-full rounded-xl h-12">
              إضافة السيارة
            </Button>
            <DrawerClose asChild>
              <Button variant="outline" className="w-full rounded-xl">إلغاء</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default Cars;
