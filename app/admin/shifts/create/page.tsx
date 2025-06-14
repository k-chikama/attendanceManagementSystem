"use client";

import { useState, useEffect, useRef, useReducer } from "react";
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
  getShiftsByUser,
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

export default function AdminCreateShiftPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<SafeUser | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [staff, setStaff] = useState<SafeUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<ShiftType>("early");
  const [existingShifts, setExistingShifts] = useState<any[]>([]);
  const [month, setMonth] = useState<Date>(startOfMonth(selectedDate));
  const daysInMonth = getDaysInMonth(month);
  const daysArray = Array.from({ length: daysInMonth }, (_, i) =>
    addDays(month, i)
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

  // Firebase Authからuser情報を取得
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const profile = await getUserProfile(firebaseUser.uid);
        if (profile) {
          setUser({
            id: profile.uid,
            name: profile.name || "",
            email: profile.email || "",
            role: profile.role || "employee",
            department: profile.department || "",
            position: profile.position || "",
            createdAt: profile.createdAt || "",
            updatedAt: profile.updatedAt || "",
          });
          setRole(profile.role || "employee");
        }
      } else {
        setUser(null);
        setRole(null);
      }
    });
    return () => unsubscribe();
  }, []);

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
          role: u.role || "employee",
          department: u.department || "",
          position: u.position || "",
          createdAt: u.createdAt || "",
          updatedAt: u.updatedAt || "",
        }));
        setStaff(allStaff);
        // 選択された日付のシフトを取得
        getShiftsByUser(format(selectedDate, "yyyy-MM-dd")).then(
          setExistingShifts
        );
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
      getShiftsByUser(format(date, "yyyy-MM-dd")).then(setExistingShifts);
    }
  };

  // セルクリックでポップオーバーを開く
  const handleCellClick = (staffId: string, dayIdx: number) => {
    setPopover({ staffId, dayIdx });
  };

  // シフト種別選択
  const handleSelectShiftType = async (shiftType: ShiftType | null) => {
    if (!popover) return;
    const { staffId, dayIdx } = popover;
    if (!cellShiftsRef.current[staffId]) return;
    cellShiftsRef.current[staffId][dayIdx] = shiftType;
    setPopover(null);
    forceUpdate();

    // Firestore上の既存シフトを検索
    const dateStr = format(addDays(month, dayIdx), "yyyy-MM-dd");
    const shift = existingShifts.find(
      (s) => s.userId === staffId && s.date === dateStr
    );
    const shiftTypeDef = shiftTypes.find((t) => t.id === shiftType);
    if (shiftType && shiftTypeDef) {
      if (shift) {
        // 既存シフトがあれば編集
        await updateShift(shift.id, {
          type: shiftTypeDef.id,
          startTime: shiftTypeDef.defaultStartTime,
          endTime: shiftTypeDef.defaultEndTime,
          updatedAt: new Date().toISOString(),
        });
        toast({ title: "シフトを更新しました" });
      } else {
        // なければ新規作成
        await addShift({
          userId: staffId,
          date: dateStr,
          startTime: shiftTypeDef.defaultStartTime,
          endTime: shiftTypeDef.defaultEndTime,
          type: shiftTypeDef.id,
          status: "approved",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        toast({ title: "シフトを登録しました" });
      }
      // 再取得
      getShiftsByUser(format(selectedDate, "yyyy-MM-dd")).then(
        setExistingShifts
      );
    }
    if (!shiftType && shift) {
      // クリア時は削除
      await deleteShift(shift.id);
      getShiftsByUser(format(selectedDate, "yyyy-MM-dd")).then(
        setExistingShifts
      );
      toast({ title: "シフトを削除しました" });
    }
  };

  // Firestoreでシフト登録
  const handleSaveShifts = async () => {
    setIsSubmitting(true);
    const shiftsToSave: any[] = [];
    const currentMonth = month;
    for (const staffId of staff.map((s) => s.id)) {
      const cellShifts = cellShiftsRef.current[staffId] || [];
      cellShifts.forEach((shiftType, dayIdx) => {
        if (shiftType) {
          const date = addDays(currentMonth, dayIdx);
          const shiftTypeDef = shiftTypes.find((t) => t.id === shiftType);
          if (shiftTypeDef) {
            shiftsToSave.push({
              userId: staffId,
              date: format(date, "yyyy-MM-dd"),
              startTime: shiftTypeDef.defaultStartTime,
              endTime: shiftTypeDef.defaultEndTime,
              type: shiftTypeDef.id,
              status: "approved",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        }
      });
    }
    try {
      for (const shift of shiftsToSave) {
        await addShift(shift);
      }
      toast({
        title: "シフトを登録しました",
        description: shiftsToSave.length + "件のシフトを登録しました。",
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
              {/* シフト種別パレット */}
              <div className="flex flex-wrap gap-2">
                {shiftTypes.map((type) => (
                  <span
                    key={type.id}
                    className={cn(
                      "px-3 py-2 rounded font-bold text-center text-xs",
                      type.color
                    )}
                    style={{ minWidth: 60 }}
                  >
                    {type.name}
                  </span>
                ))}
              </div>
            </div>
            <CardTitle className="flex items-center mt-4">
              <CalendarDays className="h-5 w-5 mr-2" />
              {format(month, "yyyy年M月", { locale: ja })}のシフト表
            </CardTitle>
            <CardDescription>
              セルをクリックしてシフト種別を選択し、登録ボタンで保存してください。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
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
                        <div className="flex items-center gap 2">
                          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                            <User className="h 4 w 4" />
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
                        const isOpen: boolean =
                          popover?.staffId === member.id &&
                          popover?.dayIdx === dayIdx;
                        // Firestore上の既存シフトを検索
                        const shift = existingShifts.find(
                          (s) =>
                            s.userId === member.id &&
                            s.date === format(date, "yyyy-MM-dd")
                        );
                        return (
                          <td
                            key={dayIdx}
                            className={cn(
                              "border min-w-[36px] h-12 align-middle p-0 transition-all cursor-pointer",
                              isOpen ? "ring-2 ring-primary/60 z-20" : ""
                            )}
                          >
                            <div className="flex flex-col items-center justify-center h-full">
                              <Popover
                                open={isOpen}
                                onOpenChange={(open) =>
                                  !open && setPopover(null)
                                }
                              >
                                <PopoverTrigger asChild>
                                  <span
                                    className="block w-full h-full flex items-center justify-center"
                                    onClick={() =>
                                      handleCellClick(member.id, dayIdx)
                                    }
                                  >
                                    {cellShiftsRef.current[member.id] &&
                                    cellShiftsRef.current[member.id][dayIdx] ? (
                                      <span
                                        className={cn(
                                          "inline-block w-8 h-8 rounded font-bold text-xs flex items-center justify-center mx-auto",
                                          shiftTypes.find(
                                            (t) =>
                                              t.id ===
                                              cellShiftsRef.current[member.id][
                                                dayIdx
                                              ]
                                          )?.color
                                        )}
                                      >
                                        {
                                          shiftTypes.find(
                                            (t) =>
                                              t.id ===
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
                                  </span>
                                </PopoverTrigger>
                                <PopoverContent
                                  align="center"
                                  className="p-2 w-40"
                                >
                                  <div className="grid grid-cols-2 gap 2">
                                    {shiftTypes.map((type) => (
                                      <button
                                        key={type.id}
                                        type="button"
                                        className={cn(
                                          "px-2 py-2 rounded font-bold text-xs flex items-center justify-center w-full",
                                          type.color,
                                          "hover:opacity-80 transition-opacity"
                                        )}
                                        onClick={() =>
                                          handleSelectShiftType(type.id)
                                        }
                                      >
                                        {type.name}
                                      </button>
                                    ))}
                                    <button
                                      type="button"
                                      className="px-2 py-2 rounded text-xs w-full border text-muted-foreground hover:bg-muted"
                                      onClick={() =>
                                        handleSelectShiftType(null as any)
                                      }
                                    >
                                      クリア
                                    </button>
                                  </div>
                                </PopoverContent>
                              </Popover>
                              {/* Firestore上に既存シフトがある場合のみ削除ボタンを表示 */}
                              {shift && (
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="mt-1 w-6 h-6"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (
                                      window.confirm(
                                        "このシフトを削除しますか？"
                                      )
                                    ) {
                                      await deleteShift(shift.id);
                                      // 再取得
                                      getShiftsByUser(
                                        format(selectedDate, "yyyy-MM-dd")
                                      ).then(setExistingShifts);
                                      toast({ title: "シフトを削除しました" });
                                    }
                                  }}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
      </div>
    </AppLayout>
  );
}
