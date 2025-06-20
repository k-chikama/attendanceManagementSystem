"use client";

import {
  useState,
  useEffect,
  useRef,
  useReducer,
  useCallback,
  useMemo,
} from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  CalendarDays,
  Clock,
  Plus,
  User,
  Users,
  X,
  Save,
} from "lucide-react";
import {
  format,
  parse,
  isValid,
  isSameDay,
  addDays,
  startOfMonth,
  endOfMonth,
  getDate,
  getDaysInMonth,
  addMonths,
} from "date-fns";
import { ja } from "date-fns/locale";
import { getAllUsers as getAllUsersFirestore } from "@/lib/firestoreUsers";
import {
  addShift,
  getShiftsByMonth,
  deleteShift,
  updateShift,
} from "@/lib/firestoreShifts";
import AppLayout from "@/components/layout/layout";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { getUserProfile } from "@/lib/firestoreUsers";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useUser } from "@/contexts/UserContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// 時間軸の設定
const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => {
  const hour = i.toString().padStart(2, "0");
  return `${hour}:00`;
});

// シフトタイプの定義
const shiftTypes = [
  {
    id: "early" as const,
    name: "早番",
    color: "bg-blue-500",
    defaultStartTime: "09:00" as const,
    defaultEndTime: "19:00" as const,
  },
  {
    id: "late" as const,
    name: "遅番",
    color: "bg-purple-500",
    defaultStartTime: "11:00" as const,
    defaultEndTime: "21:00" as const,
  },
  {
    id: "dayoff" as const,
    name: "休み",
    color: "bg-gray-500",
    defaultStartTime: "00:00" as const,
    defaultEndTime: "00:00" as const,
  },
  {
    id: "al" as const,
    name: "AL",
    color: "bg-green-500",
    defaultStartTime: "00:00" as const,
    defaultEndTime: "00:00" as const,
  },
] as const;

type ShiftType = (typeof shiftTypes)[number]["id"];
type ShiftTime = "09:00" | "11:00" | "19:00" | "21:00" | "00:00";

// シフトの型定義を更新
type ShiftTypeForDB = "early" | "late" | "dayoff" | "al";

// 時間を分に変換する関数
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// 分を時間文字列に変換する関数
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}`;
}

// シフトの位置と幅を計算する関数
function calculateShiftPosition(shift: any) {
  if (shift.type === "dayoff" || shift.type === "al") {
    return { left: 0, width: "100%" };
  }

  const startMinutes = timeToMinutes(shift.startTime);
  const endMinutes = timeToMinutes(shift.endTime);
  const totalMinutes = 24 * 60;

  const left = (startMinutes / totalMinutes) * 100;
  const width = ((endMinutes - startMinutes) / totalMinutes) * 100;

  return { left: `${left}%`, width: `${width}%` };
}

type NewShift = {
  userId: string;
  date: string;
  startTime: ShiftTime;
  endTime: ShiftTime;
  type: ShiftTypeForDB;
};

type SafeUser = {
  id: string;
  name: string;
  email: string;
  role: "employee" | "manager" | "admin";
  department: string;
  position: string;
  createdAt: string;
  updatedAt: string;
};

const toRole = (role: string): "employee" | "manager" | "admin" => {
  if (role === "employee" || role === "manager" || role === "admin") {
    return role;
  }
  return "employee";
};

export default function AdminCreateShiftPage() {
  const router = useRouter();
  const { toast } = useToast();
  const user = useUser();
  const role = user?.role ?? null;
  const [staff, setStaff] = useState<SafeUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<ShiftType>("early");
  const [existingShifts, setExistingShifts] = useState<any[]>([]);
  const [month, setMonth] = useState<Date>(startOfMonth(selectedDate));
  const daysInMonth = getDaysInMonth(month);
  const daysArray = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => addDays(month, i)),
    [month, daysInMonth]
  );

  // 新規シフト作成用の状態
  const [newShift, setNewShift] = useState<NewShift>({
    userId: "",
    date: format(new Date(), "yyyy-MM-dd"),
    startTime: "09:00",
    endTime: "19:00",
    type: "early",
  });

  // セルごとのシフト種別をuseRefで管理
  const cellShiftsRef = useRef<{ [staffId: string]: (ShiftType | null)[] }>({});
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  // ポップオーバーの管理
  const [popover, setPopover] = useState<{
    staffId: string;
    dayIdx: number;
  } | null>(null);

  // 複数セル選択用のstate
  const [selectedCells, setSelectedCells] = useState<
    { staffId: string; dayIdx: number }[]
  >([]);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkShiftType, setBulkShiftType] = useState<ShiftType | "">("");

  // 複数選択モードの管理
  const [multiSelectMode, setMultiSelectMode] = useState(false);

  // 初期化
  useEffect(() => {
    const obj: { [staffId: string]: (ShiftType | null)[] } = {};
    staff.forEach((member) => {
      obj[member.id] = Array(daysInMonth).fill(null);
    });
    cellShiftsRef.current = obj;
    forceUpdate();
  }, [month, staff, daysInMonth]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        if (!user || user.role !== "admin") {
          router.push("/login");
          return;
        }
        // Firestoreから全スタッフ取得しSafeUser[]に変換
        const allStaffRaw = await getAllUsersFirestore();
        const allStaff: SafeUser[] = allStaffRaw.map((u: any) => ({
          id: u.uid,
          name: u.name || "",
          email: u.email || "",
          role: toRole(u.role),
          department: u.department || "",
          position: u.position || "",
          createdAt: u.createdAt || "",
          updatedAt: u.updatedAt || "",
        }));
        setStaff(allStaff);
        // 選択された月の全シフトを取得
        const year = month.getFullYear();
        const m = month.getMonth() + 1;
        const shifts = await getShiftsByMonth(year, m);
        setExistingShifts(shifts);
      } catch (error) {
        console.error("データの読み込みに失敗:", error);
        toast({
          variant: "destructive",
          title: "エラー",
          description: "データの読み込みに失敗しました",
        });
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [router, toast, selectedDate, user, daysInMonth, month]);

  // 既存シフトをcellShiftsRefに反映
  useEffect(() => {
    const obj: { [staffId: string]: (ShiftType | null)[] } = {};
    staff.forEach((member) => {
      obj[member.id] = Array(daysInMonth).fill(null);
    });
    existingShifts.forEach((shift: any) => {
      const staffId = shift.userId;
      const dayIdx = daysArray.findIndex(
        (date) => format(date, "yyyy-MM-dd") === shift.date
      );
      if (obj[staffId] && dayIdx >= 0) {
        obj[staffId][dayIdx] = shift.type;
      }
    });
    cellShiftsRef.current = obj;
    forceUpdate();
  }, [month, staff, daysInMonth, existingShifts.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // 選択されたスタッフ全員にシフトを作成
      for (const staffId of selectedStaff) {
        const shift: any = {
          userId: staffId,
          date: format(selectedDate, "yyyy-MM-dd"),
          startTime: newShift.startTime,
          endTime: newShift.endTime,
          type: newShift.type as ShiftTypeForDB,
          status: "approved",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await addShift(shift);
      }

      toast({
        title: "シフトを作成しました",
        description: `${selectedStaff.length}名のスタッフにシフトを割り当てました`,
      });

      router.push("/admin/shifts");
    } catch (error) {
      console.error("シフト作成エラー:", error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "シフトの作成に失敗しました",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStaffSelect = (staffId: string) => {
    setSelectedStaff((prev) =>
      prev.includes(staffId)
        ? prev.filter((id) => id !== staffId)
        : [...prev, staffId]
    );
  };

  // シフトタイプが変更された時の処理を修正
  const handleShiftTypeChange = (type: ShiftType) => {
    setSelectedType(type);
    const selectedShiftType = shiftTypes.find((t) => t.id === type);
    if (selectedShiftType) {
      setNewShift((prev) => ({
        ...prev,
        type,
        startTime: selectedShiftType.defaultStartTime as ShiftTime,
        endTime: selectedShiftType.defaultEndTime as ShiftTime,
      }));
    }
  };

  // 日付が変更された時の処理
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      getShiftsByMonth(date.getFullYear(), date.getMonth() + 1).then(
        setExistingShifts
      );
    }
  };

  // セルクリックでポップオーバーを開く
  const handleCellClick = useCallback(
    (staffId: string, dayIdx: number) => {
      // 既に同じセルが開いている場合は閉じる
      if (popover?.staffId === staffId && popover?.dayIdx === dayIdx) {
        setPopover(null);
      } else {
        // 新しいセルを開く
        setPopover({ staffId, dayIdx });
      }
    },
    [popover]
  );

  // シフト種別選択
  const handleSelectShiftType = useCallback(
    (shiftType: ShiftType | null) => {
      if (!popover) return;
      const { staffId, dayIdx } = popover;
      if (!cellShiftsRef.current[staffId]) return;
      cellShiftsRef.current[staffId][dayIdx] = shiftType;
      setPopover(null);
      forceUpdate();
    },
    [popover]
  );

  // Firestoreでシフト登録
  const handleSaveShifts = async () => {
    setIsSubmitting(true);
    const currentMonth = month;
    const changes: {
      type: "add" | "update" | "delete";
      staffId: string;
      date: string;
      shiftType?: ShiftType;
      shiftId?: string;
    }[] = [];

    for (const staffId of staff.map((s) => s.id)) {
      const cellShifts = cellShiftsRef.current[staffId] || [];
      cellShifts.forEach((shiftType, dayIdx) => {
        const date = format(addDays(currentMonth, dayIdx), "yyyy-MM-dd");
        const existing = existingShifts.find(
          (s) => s.userId === staffId && s.date === date
        );
        if (shiftType) {
          if (!existing) {
            // 新規追加
            changes.push({ type: "add", staffId, date, shiftType });
          } else if (existing.type !== shiftType) {
            // 値が違う場合のみ更新
            changes.push({
              type: "update",
              staffId,
              date,
              shiftType,
              shiftId: existing.id,
            });
          }
          // 既存と同じ値なら何もしない
        } else if (existing) {
          // 画面上が空で既存がある場合のみ削除
          changes.push({ type: "delete", staffId, date, shiftId: existing.id });
        }
        // 画面上も空、既存もなし→何もしない
      });
    }

    const changesCount = changes.length;

    try {
      for (const change of changes) {
        if (change.type === "add") {
          const shiftTypeDef = shiftTypes.find(
            (t) => t.id === change.shiftType
          );
          if (shiftTypeDef) {
            await addShift({
              userId: change.staffId,
              date: change.date,
              startTime: shiftTypeDef.defaultStartTime,
              endTime: shiftTypeDef.defaultEndTime,
              type: shiftTypeDef.id,
              status: "approved",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        } else if (change.type === "update" && change.shiftId) {
          const shiftTypeDef = shiftTypes.find(
            (t) => t.id === change.shiftType
          );
          if (shiftTypeDef) {
            await updateShift(change.shiftId, {
              type: shiftTypeDef.id,
              startTime: shiftTypeDef.defaultStartTime,
              endTime: shiftTypeDef.defaultEndTime,
              updatedAt: new Date().toISOString(),
            });
          }
        } else if (change.type === "delete" && change.shiftId) {
          await deleteShift(change.shiftId);
        }
      }
      toast({
        title: "シフトを登録しました",
        description: `${changesCount}件のシフトを更新しました。`,
      });
    } catch (error) {
      console.error("シフト登録エラー:", error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "シフトの登録に失敗しました。",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // セル選択/解除
  const toggleCellSelection = (staffId: string, dayIdx: number) => {
    setSelectedCells((prev) => {
      const exists = prev.some(
        (c) => c.staffId === staffId && c.dayIdx === dayIdx
      );
      if (exists) {
        return prev.filter(
          (c) => !(c.staffId === staffId && c.dayIdx === dayIdx)
        );
      }
      return [...prev, { staffId, dayIdx }];
    });
  };

  // 一括編集の適用
  const handleBulkEdit = () => {
    if (!bulkShiftType) return;
    selectedCells.forEach(({ staffId, dayIdx }) => {
      if (!cellShiftsRef.current[staffId]) return;
      cellShiftsRef.current[staffId][dayIdx] = bulkShiftType;
    });
    setIsBulkEditOpen(false);
    setBulkShiftType("");
    setSelectedCells([]);
    forceUpdate();
  };

  // シフトタイプの検索を最適化
  const getShiftTypeInfo = useCallback((shiftType: ShiftType | null) => {
    if (!shiftType) return null;
    return shiftTypes.find((t) => t.id === shiftType);
  }, []);

  if (!user || role === null) {
    return null;
  }

  if (role !== "admin") {
    return (
      <div className="text-center text-red-500 py-10">
        管理者権限がありません
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-2 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center mb-2 mt-2">
              <CalendarDays className="h-5 w-5 mr-2" />
              {format(month, "yyyy年M月", { locale: ja })}のシフト表
            </CardTitle>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              {/* 月選択 */}
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setMonth(startOfMonth(addMonths(month, -1)))}
                >
                  {"<"}
                </Button>
                <span className="font-bold text-lg">
                  {format(month, "yyyy年M月", { locale: ja })}
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setMonth(startOfMonth(addMonths(month, 1)))}
                >
                  {">"}
                </Button>
              </div>
              {/* 複数選択モードボタン */}
              <div className="flex items-center gap-2 mt-2">
                <Button
                  variant={multiSelectMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMultiSelectMode((v) => !v)}
                  aria-pressed={multiSelectMode}
                >
                  {multiSelectMode ? "複数選択モード中" : "複数選択モード"}
                </Button>
                {multiSelectMode && (
                  <span className="text-xs text-muted-foreground">
                    セルをタップ/クリックで複数選択・解除できます
                  </span>
                )}
              </div>
            </div>
            <CardDescription>
              セルをクリックしてシフト種別を選択し、登録ボタンで保存してください。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* PC用テーブル（横軸：日付・縦軸：スタッフ） */}
            <div className="overflow-x-auto hidden md:block">
              <table className="min-w-[1200px] border text-center">
                <thead>
                  <tr>
                    <th className="w-40 bg-background sticky left-0 z-10">
                      スタッフ
                    </th>
                    {daysArray.map((date, i) => (
                      <th
                        key={i}
                        className="border bg-muted text-xs font-normal px-1 py-2"
                      >
                        {getDate(date)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {staff.map((member) => (
                    <tr key={member.id} className="h-12">
                      <td className="bg-background sticky left-0 z-10 border-r min-w-[120px] text-left px-2">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                            <User className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {member.name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {member.department} / {member.position}
                            </p>
                          </div>
                        </div>
                      </td>
                      {daysArray.map((date, dayIdx) => {
                        const isOpen =
                          popover?.staffId === member.id &&
                          popover?.dayIdx === dayIdx;
                        const isSelected = selectedCells.some(
                          (c) => c.staffId === member.id && c.dayIdx === dayIdx
                        );
                        return (
                          <td
                            key={dayIdx}
                            className={cn(
                              "border min-w-[36px] h-12 align-middle p-0 transition-all cursor-pointer",
                              isOpen ? "ring-2 ring-primary/60 z-20" : "",
                              isSelected
                                ? "ring-2 ring-green-500 ring-offset-2"
                                : ""
                            )}
                          >
                            <div className="flex flex-col items-center justify-center h-full">
                              <Popover
                                open={isOpen}
                                onOpenChange={(open) => {
                                  // ポップアップが開いている状態で、外側をクリックした場合のみ閉じる
                                  if (!open && isOpen) {
                                    setPopover(null);
                                  }
                                }}
                              >
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    tabIndex={0}
                                    className="block w-full h-full flex items-center justify-center relative"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      handleCellClick(member.id, dayIdx);
                                    }}
                                    onPointerDown={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                    }}
                                  >
                                    {cellShiftsRef.current[member.id] &&
                                    cellShiftsRef.current[member.id][dayIdx] ? (
                                      <span
                                        className={cn(
                                          "inline-block w-8 h-8 rounded font-bold text-xs flex items-center justify-center mx-auto",
                                          getShiftTypeInfo(
                                            cellShiftsRef.current[member.id][
                                              dayIdx
                                            ]
                                          )?.color
                                        )}
                                      >
                                        {
                                          getShiftTypeInfo(
                                            cellShiftsRef.current[member.id][
                                              dayIdx
                                            ]
                                          )?.name
                                        }
                                      </span>
                                    ) : (
                                      <span className="inline-block w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                                        -
                                      </span>
                                    )}
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent
                                  align="center"
                                  side="top"
                                  sideOffset={8}
                                  className="w-48 p-3 z-[99999]"
                                  onPointerDownOutside={(e) => {
                                    e.preventDefault();
                                  }}
                                  onInteractOutside={(e) => {
                                    e.preventDefault();
                                  }}
                                >
                                  <div className="grid grid-cols-2 gap-2">
                                    {shiftTypes.map((type) => (
                                      <button
                                        key={type.id}
                                        type="button"
                                        className={cn(
                                          "px-3 py-2 text-sm font-medium rounded-md transition-colors text-white hover:opacity-90",
                                          type.color
                                        )}
                                        onClick={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          handleSelectShiftType(type.id);
                                        }}
                                        onPointerDown={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                        }}
                                      >
                                        {type.name}
                                      </button>
                                    ))}
                                    <button
                                      type="button"
                                      className="px-3 py-2 text-sm font-medium rounded-md transition-colors bg-gray-200 hover:bg-gray-300 col-span-2"
                                      onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        handleSelectShiftType(null);
                                      }}
                                      onPointerDown={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                      }}
                                    >
                                      クリア
                                    </button>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* スマホ用テーブル（縦軸：日付・横軸：スタッフ） */}
            <div className="overflow-x-auto block md:hidden">
              <div className="rounded-lg shadow bg-white p-2">
                <table className="min-w-full border text-center text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="w-20 sticky left-0 z-10 bg-gray-100 font-bold text-xs py-2 border-r">
                        日付
                      </th>
                      {staff.map((member) => (
                        <th
                          key={member.id}
                          className="border bg-gray-100 font-bold text-xs px-1 py-2 min-w-[80px]"
                        >
                          <div className="flex flex-col items-center">
                            <span className="font-bold text-xs truncate">
                              {member.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground truncate">
                              {member.department}
                            </span>
                            <span className="text-[10px] text-muted-foreground truncate">
                              {member.position}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {daysArray.map((date, dayIdx) => (
                      <tr key={dayIdx} className="h-14">
                        <td className="bg-gray-50 sticky left-0 z-10 border-r min-w-[80px] text-left px-2 font-bold text-xs">
                          <span>{format(date, "M/d (E)", { locale: ja })}</span>
                        </td>
                        {staff.map((member) => {
                          const isOpen =
                            popover?.staffId === member.id &&
                            popover?.dayIdx === dayIdx;
                          const isSelected = selectedCells.some(
                            (c) =>
                              c.staffId === member.id && c.dayIdx === dayIdx
                          );
                          return (
                            <td
                              key={member.id}
                              className={cn(
                                "border min-w-[48px] h-14 align-middle p-0 transition-all cursor-pointer bg-white",
                                isOpen ? "ring-2 ring-primary/60 z-20" : "",
                                isSelected
                                  ? "ring-2 ring-green-500 ring-offset-2"
                                  : ""
                              )}
                            >
                              <div className="flex flex-col items-center justify-center h-full">
                                <Popover
                                  open={isOpen}
                                  onOpenChange={(open) => {
                                    // ポップアップが開いている状態で、外側をクリックした場合のみ閉じる
                                    if (!open && isOpen) {
                                      setPopover(null);
                                    }
                                  }}
                                >
                                  <PopoverTrigger asChild>
                                    <button
                                      type="button"
                                      tabIndex={0}
                                      className="block w-full h-full flex items-center justify-center relative"
                                      onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        handleCellClick(member.id, dayIdx);
                                      }}
                                      onPointerDown={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                      }}
                                    >
                                      {cellShiftsRef.current[member.id] &&
                                      cellShiftsRef.current[member.id][
                                        dayIdx
                                      ] ? (
                                        <span
                                          className={cn(
                                            "inline-block w-10 h-10 rounded-lg font-bold text-sm flex items-center justify-center mx-auto shadow",
                                            getShiftTypeInfo(
                                              cellShiftsRef.current[member.id][
                                                dayIdx
                                              ]
                                            )?.color
                                          )}
                                        >
                                          {
                                            getShiftTypeInfo(
                                              cellShiftsRef.current[member.id][
                                                dayIdx
                                              ]
                                            )?.name
                                          }
                                        </span>
                                      ) : (
                                        <span className="inline-block w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                                          -
                                        </span>
                                      )}
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent
                                    align="center"
                                    side="top"
                                    sideOffset={8}
                                    className="w-48 p-3 z-[99999]"
                                    onPointerDownOutside={(e) => {
                                      e.preventDefault();
                                    }}
                                    onInteractOutside={(e) => {
                                      e.preventDefault();
                                    }}
                                  >
                                    <div className="grid grid-cols-2 gap-2">
                                      {shiftTypes.map((type) => (
                                        <button
                                          key={type.id}
                                          type="button"
                                          className={cn(
                                            "px-3 py-2 text-sm font-medium rounded-md transition-colors text-white hover:opacity-90",
                                            type.color
                                          )}
                                          onClick={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            handleSelectShiftType(type.id);
                                          }}
                                          onPointerDown={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                          }}
                                        >
                                          {type.name}
                                        </button>
                                      ))}
                                      <button
                                        type="button"
                                        className="px-3 py-2 text-sm font-medium rounded-md transition-colors bg-gray-200 hover:bg-gray-300 col-span-2"
                                        onClick={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                          handleSelectShiftType(null);
                                        }}
                                        onPointerDown={(event) => {
                                          event.preventDefault();
                                          event.stopPropagation();
                                        }}
                                      >
                                        クリア
                                      </button>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {/* 一括編集UI（共通） */}
            {selectedCells.length > 0 && (
              <div className="flex items-center gap-2 my-2">
                <span className="text-sm text-muted-foreground">
                  {selectedCells.length}件選択中
                </span>
                <Button size="sm" onClick={() => setIsBulkEditOpen(true)}>
                  一括編集
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedCells([])}
                >
                  選択解除
                </Button>
              </div>
            )}
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-4">
              <div className="text-sm text-muted-foreground">
                <p>※ シフトを登録すると、スタッフのシフト表に反映されます。</p>
                <p>※ 既存のシフトがある場合は上書きされます。</p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    // 全てのセルをクリア
                    staff.forEach((member) => {
                      if (cellShiftsRef.current[member.id]) {
                        cellShiftsRef.current[member.id] =
                          Array(daysInMonth).fill(null);
                      }
                    });
                    forceUpdate();
                    toast({
                      title: "シフトをクリアしました",
                      description: "全てのシフトをクリアしました。",
                    });
                  }}
                  className="w-full sm:w-auto"
                >
                  <X className="h-4 w-4 mr-2" />
                  クリア
                </Button>
                <Button
                  variant="default"
                  onClick={handleSaveShifts}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                  size="lg"
                >
                  <Save className="h-5 w-5 mr-2" />
                  {isSubmitting ? (
                    <>
                      <span className="animate-pulse">登録中...</span>
                    </>
                  ) : (
                    <>
                      <span className="font-bold">シフトを登録</span>
                      <span className="text-xs ml-2 opacity-80">
                        ({staff.length}名分)
                      </span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <Dialog open={isBulkEditOpen} onOpenChange={setIsBulkEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>シフト一括編集</DialogTitle>
              <DialogDescription>
                選択した{selectedCells.length}
                件のセルにシフト種別を一括で割り当てます。
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Select
                value={bulkShiftType}
                onValueChange={(value) => setBulkShiftType(value as ShiftType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="シフト種別を選択" />
                </SelectTrigger>
                <SelectContent>
                  {shiftTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsBulkEditOpen(false)}
              >
                キャンセル
              </Button>
              <Button onClick={handleBulkEdit} disabled={!bulkShiftType}>
                適用
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
