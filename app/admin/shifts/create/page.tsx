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
  AlertTriangle,
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
import { getApprovedLeaveRequests, type LeaveRequest } from "@/lib/leave";
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

// 祝日判定用の簡易的な関数（実際の運用では祝日APIを使用することを推奨）
const isHoliday = (date: Date): boolean => {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  // 日本の主要な祝日（簡易版）
  const holidays = [
    { month: 1, day: 1 }, // 元日
    { month: 1, day: 9 }, // 成人の日（第2月曜日）
    { month: 2, day: 11 }, // 建国記念の日
    { month: 2, day: 23 }, // 天皇誕生日
    { month: 3, day: 21 }, // 春分の日
    { month: 4, day: 29 }, // 昭和の日
    { month: 5, day: 3 }, // 憲法記念日
    { month: 5, day: 4 }, // みどりの日
    { month: 5, day: 5 }, // こどもの日
    { month: 7, day: 17 }, // 海の日
    { month: 8, day: 11 }, // 山の日
    { month: 9, day: 18 }, // 敬老の日
    { month: 9, day: 23 }, // 秋分の日
    { month: 10, day: 9 }, // スポーツの日
    { month: 11, day: 3 }, // 文化の日
    { month: 11, day: 23 }, // 勤労感謝の日
  ];

  return holidays.some((h) => h.month === month && h.day === day);
};

// 8のつく日かどうかを判定
const hasDateWith8 = (date: Date): boolean => {
  const day = date.getDate();
  return day === 8 || day === 18 || day === 28;
};

// 土日祝日・8のつく日かどうかを判定
const isSpecialDay = (date: Date): boolean => {
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // 日曜日(0)または土曜日(6)
  return isWeekend || isHoliday(date) || hasDateWith8(date);
};

// シフトタイプの定義
const shiftTypes = [
  {
    id: "early" as const,
    name: "早番",
    shortName: "早",
    color: "bg-sky-200 text-sky-800",
    defaultStartTime: "09:30" as const,
    defaultEndTime: "19:00" as const,
  },
  {
    id: "late" as const,
    name: "遅番",
    shortName: "遅",
    color: "bg-violet-200 text-violet-800",
    defaultStartTime: "11:30" as const,
    defaultEndTime: "21:00" as const,
  },
  {
    id: "dayoff" as const,
    name: "休み",
    shortName: "休",
    color: "bg-slate-200 text-slate-800",
    defaultStartTime: "00:00" as const,
    defaultEndTime: "00:00" as const,
  },
  {
    id: "seminar" as const,
    name: "セミナー",
    shortName: "セ",
    color: "bg-emerald-200 text-emerald-800",
    defaultStartTime: "00:00" as const,
    defaultEndTime: "00:00" as const,
  },
] as const;

type ShiftType = (typeof shiftTypes)[number]["id"];
type ShiftTime =
  | "09:00"
  | "09:30"
  | "11:00"
  | "11:30"
  | "19:00"
  | "21:00"
  | "00:00";

// シフトの型定義を更新
type ShiftTypeForDB = "early" | "late" | "dayoff" | "seminar";

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
  if (shift.type === "dayoff" || shift.type === "seminar") {
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

// ShiftCellコンポーネントを新たに定義
const ShiftCell = ({
  member,
  dayIdx,
  selectedCells,
  cellShiftsRef,
  handleSelectShiftType,
  getShiftTypeInfo,
  multiSelectMode,
  toggleCellSelection,
  isMobile = false,
}: {
  member: SafeUser;
  dayIdx: number;
  selectedCells: { staffId: string; dayIdx: number }[];
  cellShiftsRef: React.RefObject<{ [staffId: string]: (ShiftType | null)[] }>;
  handleSelectShiftType: (
    staffId: string,
    dayIdx: number,
    shiftType: ShiftType | null
  ) => void;
  getShiftTypeInfo: (
    shiftType: ShiftType | null
  ) => (typeof shiftTypes)[number] | null;
  multiSelectMode: boolean;
  toggleCellSelection: (staffId: string, dayIdx: number) => void;
  isMobile?: boolean;
}) => {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const shiftForCell = cellShiftsRef.current?.[member.id]?.[dayIdx] ?? null;
  const shiftTypeInfo = getShiftTypeInfo(shiftForCell);
  const isSelected =
    selectedCells.find(
      (cell) => cell.staffId === member.id && cell.dayIdx === dayIdx
    ) !== undefined;

  const onSelect = (type: ShiftType | null) => {
    handleSelectShiftType(member.id, dayIdx, type);
    setPopoverOpen(false); // 選択時にポップアップを閉じる
  };

  const handleCellClick = (event: React.MouseEvent) => {
    if (multiSelectMode) {
      event.preventDefault();
      toggleCellSelection(member.id, dayIdx);
    }
  };

  return (
    <td
      className={cn(
        "border text-center p-0 align-middle",
        shiftTypeInfo ? "" : "bg-background",
        isSelected
          ? isMobile
            ? "outline-blue-500 outline"
            : "outline-blue-500 outline"
          : ""
      )}
      onClick={handleCellClick}
    >
      <div
        className={cn(
          "w-full h-full text-xs flex items-center justify-center transition-colors",
          shiftTypeInfo ? shiftTypeInfo.color : "hover:bg-muted/50",
          isSelected ? "ring-2 ring-blue-500 ring-offset-1" : "",
          isMobile ? "min-w-[65px] h-16 px-1" : "h-12"
        )}
      >
        {multiSelectMode ? (
          shiftTypeInfo ? (
            <span
              className={cn(
                "font-bold px-1 py-1 rounded text-center",
                isMobile ? "text-xs" : "text-xs"
              )}
            >
              {(shiftTypeInfo as any).shortName || (shiftTypeInfo as any).name}
            </span>
          ) : (
            <span className="text-muted-foreground text-[10px]">-</span>
          )
        ) : (
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <button className="w-full h-full flex items-center justify-center min-h-[64px]">
                {shiftTypeInfo ? (
                  <span
                    className={cn(
                      "font-bold px-1 py-1 rounded text-center",
                      isMobile ? "text-xs" : "text-xs"
                    )}
                  >
                    {(shiftTypeInfo as any).shortName ||
                      (shiftTypeInfo as any).name}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-[10px]">-</span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-1"
              side={isMobile ? "bottom" : "top"}
            >
              <div className="flex flex-col gap-1">
                {shiftTypes.map((type) => (
                  <Button
                    key={type.id}
                    variant="ghost"
                    size="sm"
                    className={cn("w-full justify-start", type.color)}
                    onClick={() => onSelect(type.id)}
                  >
                    {type.name}
                  </Button>
                ))}
                <Separator />
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => onSelect(null)}
                >
                  クリア
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </td>
  );
};

// 連続勤務日数をチェックする関数
const checkConsecutiveWorkDays = (
  shifts: { [staffId: string]: (ShiftType | null)[] },
  staffId: string,
  dayIdx: number,
  maxConsecutive: number = 4
): boolean => {
  const staffShifts = shifts[staffId];
  if (!staffShifts) return true;

  let forwardCount = 0;
  // 前方向の連続勤務日数
  for (let i = dayIdx - 1; i >= 0; i--) {
    if (
      staffShifts[i] &&
      staffShifts[i] !== "dayoff" &&
      staffShifts[i] !== "seminar"
    ) {
      forwardCount++;
    } else {
      break;
    }
  }

  let backwardCount = 0;
  // 後方向の連続勤務日数
  for (let i = dayIdx + 1; i < staffShifts.length; i++) {
    if (
      staffShifts[i] &&
      staffShifts[i] !== "dayoff" &&
      staffShifts[i] !== "seminar"
    ) {
      backwardCount++;
    } else {
      break;
    }
  }

  // チェック対象日自身も勤務日なので+1する
  const totalConsecutive = forwardCount + backwardCount + 1;

  return totalConsecutive <= maxConsecutive;
};

// 各日の早番・遅番の比率が妥当かチェックする関数
const isShiftBalanceValid = (
  shifts: { [staffId: string]: (ShiftType | null)[] },
  dayIdx: number,
  staffIds: string[]
): boolean => {
  const workingStaffIds = staffIds.filter(
    (id) =>
      shifts[id]?.[dayIdx] &&
      shifts[id][dayIdx] !== "dayoff" &&
      shifts[id][dayIdx] !== "seminar"
  );
  const workingStaffCount = workingStaffIds.length;

  if (workingStaffCount === 0) return true;

  const earlyStaffCount = workingStaffIds.filter(
    (id) => shifts[id][dayIdx] === "early"
  ).length;
  const lateStaffCount = workingStaffIds.filter(
    (id) => shifts[id][dayIdx] === "late"
  ).length;
  const minEarly = Math.max(2, Math.floor(workingStaffCount * 0.4));
  const minLate = Math.max(2, Math.floor(workingStaffCount * 0.4));

  return earlyStaffCount >= minEarly && lateStaffCount >= minLate;
};

// 連続勤務日数を減らすためのスワップ関数
const reduceConsecutiveWorkDays = (
  shifts: { [staffId: string]: (ShiftType | null)[] },
  staffIds: string[],
  month: Date,
  daysInMonth: number
): boolean => {
  for (const staffId of staffIds) {
    for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
      if (
        shifts[staffId][dayIdx] &&
        shifts[staffId][dayIdx] !== "dayoff" &&
        shifts[staffId][dayIdx] !== "seminar" &&
        !checkConsecutiveWorkDays(shifts, staffId, dayIdx, 5)
      ) {
        const sourceDay = dayIdx;
        const originalShiftType = shifts[staffId][sourceDay];

        const sourceDate = addDays(month, sourceDay);
        const isSourceSpecial = isSpecialDay(sourceDate);
        const sourceStaffCount = staffIds.filter(
          (id) => shifts[id][sourceDay] !== "dayoff"
        ).length;
        const newSourceStaffCount = sourceStaffCount - 1;

        let isSourceDayValid = false;
        if (isSourceSpecial) {
          if (newSourceStaffCount >= 6) isSourceDayValid = true;
        } else {
          if (newSourceStaffCount >= 4) isSourceDayValid = true;
        }

        if (!isSourceDayValid) continue;

        for (let targetDay = 0; targetDay < daysInMonth; targetDay++) {
          if (shifts[staffId][targetDay] === "dayoff") {
            const targetDate = addDays(month, targetDay);
            const isTargetSpecial = isSpecialDay(targetDate);
            const targetStaffCount = staffIds.filter(
              (id) => shifts[id][targetDay] !== "dayoff"
            ).length;
            const newTargetStaffCount = targetStaffCount + 1;

            let isTargetDayValid = false;
            if (isTargetSpecial) {
              isTargetDayValid = true;
            } else {
              if (newTargetStaffCount <= 5) isTargetDayValid = true;
            }

            if (isTargetDayValid) {
              // 副作用チェック用の仮シフト作成
              const tempShifts = JSON.parse(JSON.stringify(shifts));
              tempShifts[staffId][sourceDay] = "dayoff";
              tempShifts[staffId][targetDay] = originalShiftType;

              // 1. スワップで新たな連勤が発生しないか
              const isConsecutiveOk = checkConsecutiveWorkDays(
                tempShifts,
                staffId,
                targetDay,
                5
              );

              // 2. スワップ後の早番/遅番比率が崩れないか
              const isSourceBalanceOk = isShiftBalanceValid(
                tempShifts,
                sourceDay,
                staffIds
              );
              const isTargetBalanceOk = isShiftBalanceValid(
                tempShifts,
                targetDay,
                staffIds
              );

              if (isConsecutiveOk && isSourceBalanceOk && isTargetBalanceOk) {
                // 安全なスワップを実行
                shifts[staffId][sourceDay] = "dayoff";
                shifts[staffId][targetDay] = originalShiftType;
                return true;
              }
            }
          }
        }
      }
    }
  }
  return false;
};

const validateAllShifts = (
  shifts: { [staffId: string]: (ShiftType | null)[] },
  staff: SafeUser[],
  month: Date,
  daysInMonth: number
): string[] => {
  const warnings: string[] = [];
  const staffIds = staff.map((s) => s.id);

  // 1. スタッフごとの検証
  staff.forEach((member) => {
    const staffShifts = shifts[member.id];
    if (!staffShifts) {
      warnings.push(`${member.name}: シフトデータがありません。`);
      return; // 次のスタッフへ
    }

    // 休み日数の検証
    const dayOffCount = staffShifts.filter((s) => s === "dayoff").length;
    if (dayOffCount !== 8) {
      warnings.push(
        `${member.name}: 休みの日数が${dayOffCount}日です（8日であるべきです）。`
      );
    }

    // 5連勤以上の検証
    let consecutiveCount = 0;
    let fiveConsecutiveCount = 0;
    for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
      if (
        staffShifts[dayIdx] &&
        staffShifts[dayIdx] !== "dayoff" &&
        staffShifts[dayIdx] !== "seminar"
      ) {
        consecutiveCount++;
      } else {
        if (consecutiveCount === 5) {
          fiveConsecutiveCount++;
        }
        if (consecutiveCount > 5) {
          warnings.push(
            `${member.name}: ${format(
              addDays(month, dayIdx - consecutiveCount),
              "M/d"
            )}から${consecutiveCount}連勤になっています（6連勤以上は禁止です）。`
          );
        }
        consecutiveCount = 0;
      }
    }
    // 月末が連勤で終わる場合も考慮
    if (consecutiveCount === 5) {
      fiveConsecutiveCount++;
    }
    if (consecutiveCount > 5) {
      warnings.push(
        `${member.name}: ${format(
          addDays(month, daysInMonth - consecutiveCount),
          "M/d"
        )}から${consecutiveCount}連勤になっています（6連勤以上は禁止です）。`
      );
    }
    if (fiveConsecutiveCount > 1) {
      warnings.push(
        `${member.name}: 5連勤が${fiveConsecutiveCount}回あります（月1回まで許可）。`
      );
    }
  });

  // 2. 日ごとの検証
  for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
    const currentDate = addDays(month, dayIdx);
    const dateStr = format(currentDate, "M月d日");

    const workingStaffIds = staffIds.filter(
      (id) => shifts[id]?.[dayIdx] && shifts[id][dayIdx] !== "dayoff"
    );
    const workingStaffCount = workingStaffIds.length;

    // 人数確認
    const specialDay = isSpecialDay(currentDate);
    if (staffIds.length === 6) {
      // 6人の場合の条件
      if (specialDay) {
        if (workingStaffCount < 5) {
          warnings.push(
            `${dateStr}: 特別日の勤務が${workingStaffCount}人です（5人以上必要です）。`
          );
        }
      } else {
        if (workingStaffCount < 3 || workingStaffCount > 4) {
          warnings.push(
            `${dateStr}: 平日の勤務が${workingStaffCount}人です（3人または4人であるべきです）。`
          );
        }
      }
      if (workingStaffCount > 0) {
        const earlyStaffCount = workingStaffIds.filter(
          (id) => shifts[id][dayIdx] === "early"
        ).length;
        const lateStaffCount = workingStaffIds.filter(
          (id) => shifts[id][dayIdx] === "late"
        ).length;
        if (specialDay) {
          if (earlyStaffCount < 2) {
            warnings.push(
              `${dateStr}: 早番が${earlyStaffCount}人です（特別日は最低2人必要です）。`
            );
          }
          if (lateStaffCount < 2) {
            warnings.push(
              `${dateStr}: 遅番が${lateStaffCount}人です（特別日は最低2人必要です）。`
            );
          }
        } else {
          if (earlyStaffCount < 1) {
            warnings.push(
              `${dateStr}: 早番が${earlyStaffCount}人です（平日は最低1人必要です）。`
            );
          }
          if (lateStaffCount < 2) {
            warnings.push(
              `${dateStr}: 遅番が${lateStaffCount}人です（平日は最低2人必要です）。`
            );
          }
        }
      }
    } else {
      // 従来の条件
      if (specialDay) {
        if (workingStaffCount < 6) {
          warnings.push(
            `${dateStr}: 特別日の勤務が${workingStaffCount}人です（6人以上必要です）。`
          );
        }
      } else {
        if (workingStaffCount < 4 || workingStaffCount > 5) {
          warnings.push(
            `${dateStr}: 平日の勤務が${workingStaffCount}人です（4人または5人であるべきです）。`
          );
        }
      }
      if (workingStaffCount > 0) {
        const earlyStaffCount = workingStaffIds.filter(
          (id) => shifts[id][dayIdx] === "early"
        ).length;
        const lateStaffCount = workingStaffIds.filter(
          (id) => shifts[id][dayIdx] === "late"
        ).length;
        const minEarly = Math.max(2, Math.floor(workingStaffCount * 0.4));
        const minLate = Math.max(2, Math.floor(workingStaffCount * 0.4));
        if (earlyStaffCount < minEarly) {
          warnings.push(
            `${dateStr}: 早番が${earlyStaffCount}人です（最低${minEarly}人必要です）。`
          );
        }
        if (lateStaffCount < minLate) {
          warnings.push(
            `${dateStr}: 遅番が${lateStaffCount}人です（最低${minLate}人必要です）。`
          );
        }
      }
    }
  }

  return warnings;
};

export default function AdminCreateShiftPage() {
  const router = useRouter();
  const { toast } = useToast();
  const user = useUser();
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
    startTime: "09:30",
    endTime: "19:00",
    type: "early",
  });

  // セルごとのシフト種別をuseRefで管理
  const cellShiftsRef = useRef<{ [staffId: string]: (ShiftType | null)[] }>({});
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  // 複数セル選択用のstate
  const [selectedCells, setSelectedCells] = useState<
    { staffId: string; dayIdx: number }[]
  >([]);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkShiftType, setBulkShiftType] = useState<ShiftType | "">("");
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  // 複数選択モードの管理
  const [multiSelectMode, setMultiSelectMode] = useState(false);

  // 休暇申請承認済みの状態
  const [approvedLeaves, setApprovedLeaves] = useState<LeaveRequest[]>([]);
  const [userMap, setUserMap] = useState<{ [userId: string]: string }>({});

  // 初期化
  useEffect(() => {
    const obj: { [staffId: string]: (ShiftType | null)[] } = {};
    staff.forEach((member) => {
      obj[member.id] = Array(daysInMonth).fill(null);
    });
    cellShiftsRef.current = obj;
    setValidationWarnings([]); // 月変更で警告をクリア
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

        // 承認済みの休暇申請を取得
        const leaves = await getApprovedLeaveRequests();
        setApprovedLeaves(leaves);

        // ユーザー名マッピングを作成
        const userMapping: { [userId: string]: string } = {};
        allStaff.forEach((user) => {
          userMapping[user.id] = user.name;
        });
        setUserMap(userMapping);
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

  // シフト種別選択
  const handleSelectShiftType = useCallback(
    (staffId: string, dayIdx: number, shiftType: ShiftType | null) => {
      if (!cellShiftsRef.current[staffId]) return;
      cellShiftsRef.current[staffId][dayIdx] = shiftType;
      setValidationWarnings([]); // 編集で警告をクリア
      forceUpdate();
    },
    []
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

  const handleAutoGenerateShifts = useCallback(() => {
    const staffIds = staff.map((s) => s.id);
    const numStaff = staffIds.length;

    // 5人、6人、7人のみ対応
    if (numStaff < 5 || numStaff > 7) {
      toast({
        variant: "destructive",
        title: "スタッフ数エラー",
        description: "自動作成は5人、6人、7人の場合のみ対応しています。",
      });
      return;
    }

    if (daysInMonth < 8) {
      toast({
        variant: "destructive",
        title: "作成不可",
        description: `月の日数が${daysInMonth}日のため、8日間の休みを確保できません。`,
      });
      return;
    }

    const MAX_ATTEMPTS = 30;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const newCellShifts: { [staffId: string]: (ShiftType | null)[] } = {};

      // 初期化
      staffIds.forEach((staffId) => {
        newCellShifts[staffId] = Array(daysInMonth).fill(null);
      });

      // Phase 1: 各日ごとに早番・遅番・休みをランダム配置
      for (let dayIdx = 0; dayIdx < daysInMonth; dayIdx++) {
        const currentDate = addDays(month, dayIdx);
        const isSpecial = isSpecialDay(currentDate);

        let earlyCount: number, lateCount: number, offCount: number;

        // スタッフ人数ごとの配分
        if (numStaff === 5) {
          if (isSpecial) {
            earlyCount = 2;
            lateCount = 3;
            offCount = 0;
          } else {
            earlyCount = 2;
            lateCount = 2;
            offCount = 1;
          }
        } else if (numStaff === 6) {
          if (isSpecial) {
            earlyCount = 2;
            lateCount = 3;
            offCount = 1;
          } else {
            earlyCount = 2;
            lateCount = 2;
            offCount = 2;
          }
        } else {
          // 7人
          if (isSpecial) {
            earlyCount = 3;
            lateCount = 3;
            offCount = 1;
          } else {
            earlyCount = 2;
            lateCount = 3;
            offCount = 2;
          }
        }

        // スタッフをシャッフルして割り当て
        const shuffledStaff = [...staffIds].sort(() => Math.random() - 0.5);

        let staffIndex = 0;

        // 早番を割り当て
        for (let i = 0; i < earlyCount; i++) {
          if (staffIndex < shuffledStaff.length) {
            newCellShifts[shuffledStaff[staffIndex]][dayIdx] = "early";
            staffIndex++;
          }
        }

        // 遅番を割り当て
        for (let i = 0; i < lateCount; i++) {
          if (staffIndex < shuffledStaff.length) {
            newCellShifts[shuffledStaff[staffIndex]][dayIdx] = "late";
            staffIndex++;
          }
        }

        // 休みを割り当て
        for (let i = 0; i < offCount; i++) {
          if (staffIndex < shuffledStaff.length) {
            newCellShifts[shuffledStaff[staffIndex]][dayIdx] = "dayoff";
            staffIndex++;
          }
        }
      }

      // Phase 2: 各スタッフの休み日数を8日に調整
      for (const staffId of staffIds) {
        const staffShifts = newCellShifts[staffId];
        const offDays = staffShifts.filter(
          (shift) => shift === "dayoff"
        ).length;

        if (offDays < 8) {
          // 8日に満たない場合：平日の早番→休み、なければ遅番→休み
          const neededOffDays = 8 - offDays;
          let changedCount = 0;

          for (
            let dayIdx = 0;
            dayIdx < daysInMonth && changedCount < neededOffDays;
            dayIdx++
          ) {
            const currentDate = addDays(month, dayIdx);
            const isSpecial = isSpecialDay(currentDate);

            if (!isSpecial && staffShifts[dayIdx] === "early") {
              staffShifts[dayIdx] = "dayoff";
              changedCount++;
            }
          }

          // 早番が足りない場合は遅番から変更
          for (
            let dayIdx = 0;
            dayIdx < daysInMonth && changedCount < neededOffDays;
            dayIdx++
          ) {
            const currentDate = addDays(month, dayIdx);
            const isSpecial = isSpecialDay(currentDate);

            if (!isSpecial && staffShifts[dayIdx] === "late") {
              staffShifts[dayIdx] = "dayoff";
              changedCount++;
            }
          }
        } else if (offDays > 8) {
          // 8日を超える場合：土日祝8の付く日の休み→遅番、なければ平日の休み→遅番
          const excessOffDays = offDays - 8;
          let changedCount = 0;

          // まず土日祝8の付く日の休みを遅番に変更
          for (
            let dayIdx = 0;
            dayIdx < daysInMonth && changedCount < excessOffDays;
            dayIdx++
          ) {
            const currentDate = addDays(month, dayIdx);
            const isSpecial = isSpecialDay(currentDate);

            if (isSpecial && staffShifts[dayIdx] === "dayoff") {
              staffShifts[dayIdx] = "late";
              changedCount++;
            }
          }

          // 土日祝8の付く日の休みが足りない場合は平日の休みを遅番に変更
          for (
            let dayIdx = 0;
            dayIdx < daysInMonth && changedCount < excessOffDays;
            dayIdx++
          ) {
            const currentDate = addDays(month, dayIdx);
            const isSpecial = isSpecialDay(currentDate);

            if (!isSpecial && staffShifts[dayIdx] === "dayoff") {
              staffShifts[dayIdx] = "late";
              changedCount++;
            }
          }
        }
      }

      // Phase 3: バリデーションチェック
      const warnings = validateAllShifts(
        newCellShifts,
        staff,
        month,
        daysInMonth
      );

      // 警告が少ない場合は採用
      if (warnings.length <= 5) {
        cellShiftsRef.current = newCellShifts;
        forceUpdate();
        setValidationWarnings(warnings);
        toast({
          title: "シフト自動作成完了",
          description: `シフト案が作成されました。警告: ${warnings.length}件`,
        });
        return;
      }
    }

    toast({
      variant: "destructive",
      title: "自動作成失敗",
      description:
        "条件を満たすシフトを作成できませんでした。もう一度お試しください。",
    });
  }, [staff, daysInMonth, toast, month]);

  // シフトタイプの検索を最適化
  const getShiftTypeInfo = useCallback(
    (shiftType: ShiftType | null): (typeof shiftTypes)[number] | null => {
      if (!shiftType) return null;
      return shiftTypes.find((t) => t.id === shiftType) ?? null;
    },
    []
  );

  if (!user || user.role === null) {
    return null;
  }

  if (user.role !== "admin") {
    return (
      <div className="text-center text-red-500 py-10">
        管理者権限がありません
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-4 px-2 sm:py-8 sm:px-6 lg:px-8">
        {/* 休暇申請承認済みリスト */}
        {approvedLeaves.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                休暇申請承認済み一覧
              </CardTitle>
              <CardDescription>
                承認済みの休暇申請があるスタッフの一覧です。シフト作成時の参考にしてください。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>申請者名</TableHead>
                      <TableHead>種類</TableHead>
                      <TableHead>期間</TableHead>
                      <TableHead>理由</TableHead>
                      <TableHead>承認日</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvedLeaves
                      .sort(
                        (a, b) =>
                          new Date(a.startDate).getTime() -
                          new Date(b.startDate).getTime()
                      )
                      .map((leave) => (
                        <TableRow key={leave.id}>
                          <TableCell className="font-medium">
                            {userMap[leave.userId] || "不明"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{leave.type}</Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(leave.startDate), "yyyy/MM/dd", {
                              locale: ja,
                            })}{" "}
                            〜{" "}
                            {format(new Date(leave.endDate), "yyyy/MM/dd", {
                              locale: ja,
                            })}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {leave.reason || "-"}
                          </TableCell>
                          <TableCell>
                            {leave.approvedAt
                              ? format(
                                  new Date(leave.approvedAt),
                                  "yyyy/MM/dd",
                                  { locale: ja }
                                )
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center mb-2 mt-2">
              <CalendarDays className="h-5 w-5 mr-2" />
              {format(month, "yyyy年M月", { locale: ja })}のシフト表
            </CardTitle>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              {/* 月選択（スマホは上） */}
              <div className="flex items-center gap-2 order-1 md:order-none">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setMonth(startOfMonth(addMonths(month, -1)))}
                  className="h-10 w-10"
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
                  className="h-10 w-10"
                >
                  {">"}
                </Button>
              </div>
              {/* 自動作成ボタン */}
              <div className="flex items-center gap-2 order-2 md:order-none">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleAutoGenerateShifts}
                  className="h-8 px-3 text-xs"
                >
                  自動作成
                </Button>
              </div>
              {/* 複数選択モードボタン（スマホは下に左寄せ） */}
              <div className="flex items-center gap-2 mt-2 md:mt-0 order-3 md:order-none w-full md:w-auto">
                <Button
                  variant={multiSelectMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMultiSelectMode((v) => !v)}
                  aria-pressed={multiSelectMode}
                  className={cn(
                    "h-8 px-3 text-xs",
                    multiSelectMode && "text-primary-foreground",
                    "justify-start md:justify-center w-full md:w-auto"
                  )}
                >
                  {multiSelectMode ? "複数選択中" : "複数選択"}
                </Button>
                {multiSelectMode && (
                  <span className="text-xs text-muted-foreground">
                    セルをタップで選択・解除
                  </span>
                )}
              </div>
            </div>
            <CardDescription>
              月を選択し、手動で入力してください。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {validationWarnings.length > 0 && (
              <div className="my-4 p-4 border-l-4 border-destructive bg-destructive/10 text-destructive rounded-r-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  <h4 className="font-bold">警告</h4>
                </div>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  {validationWarnings.map((warning, index) => (
                    <li key={index} className="text-sm">
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* PC用テーブル（横軸：日付・縦軸：スタッフ） */}
            <div className="overflow-x-auto hidden md:block">
              <table className="min-w-[1200px] border text-center">
                <thead>
                  <tr>
                    <th className="w-40 bg-background sticky left-0 z-10">
                      スタッフ
                    </th>
                    {daysArray.map((date, i) => {
                      const isSpecial = isSpecialDay(date);
                      return (
                        <th
                          key={i}
                          className={cn(
                            "border text-xs font-normal px-1 py-2",
                            isSpecial
                              ? "bg-amber-100 text-amber-800"
                              : "bg-muted"
                          )}
                        >
                          <div className="flex flex-col">
                            <span className="font-bold">{getDate(date)}</span>
                            <span className="text-[10px]">
                              {format(date, "E", { locale: ja })}
                            </span>
                          </div>
                        </th>
                      );
                    })}
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
                      {daysArray.map((date, dayIdx) => (
                        <ShiftCell
                          key={dayIdx}
                          member={member}
                          dayIdx={dayIdx}
                          selectedCells={selectedCells}
                          cellShiftsRef={cellShiftsRef}
                          handleSelectShiftType={handleSelectShiftType}
                          getShiftTypeInfo={getShiftTypeInfo}
                          multiSelectMode={multiSelectMode}
                          toggleCellSelection={toggleCellSelection}
                        />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* スマホ用テーブル（縦軸：日付・横軸：スタッフ） */}
            <div className="overflow-x-auto block md:hidden -mx-2 px-2">
              <div className="rounded-lg shadow-sm border bg-white min-w-max">
                <table className="border-collapse text-center">
                  <thead className="bg-gray-50 sticky top-0 z-20">
                    <tr>
                      <th className="w-16 sticky left-0 z-30 bg-gray-50 font-bold text-xs py-3 px-2 border-r border-b">
                        日付
                      </th>
                      {staff.map((member) => (
                        <th
                          key={member.id}
                          className="border-b bg-gray-50 font-bold text-xs px-2 py-3 min-w-[65px] max-w-[65px]"
                        >
                          <div className="flex flex-col items-center space-y-0.5">
                            <span className="font-bold text-xs truncate w-full">
                              {member.name}
                            </span>
                            <span className="text-[9px] text-muted-foreground truncate w-full">
                              {member.department}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {daysArray.map((date, dayIdx) => {
                      const isSpecial = isSpecialDay(date);
                      return (
                        <tr key={dayIdx} className="h-16">
                          <td
                            className={cn(
                              "sticky left-0 z-10 border-r min-w-[64px] text-left px-2 font-bold text-xs bg-white",
                              isSpecial
                                ? "bg-amber-50 text-amber-800"
                                : "bg-gray-50"
                            )}
                          >
                            <div className="flex flex-col items-start">
                              <span className="font-bold text-sm">
                                {format(date, "M/d", { locale: ja })}
                              </span>
                              <span className="text-[9px] text-muted-foreground">
                                {format(date, "E", { locale: ja })}
                              </span>
                            </div>
                          </td>
                          {staff.map((member) => (
                            <ShiftCell
                              key={member.id}
                              member={member}
                              dayIdx={dayIdx}
                              selectedCells={selectedCells}
                              cellShiftsRef={cellShiftsRef}
                              handleSelectShiftType={handleSelectShiftType}
                              getShiftTypeInfo={getShiftTypeInfo}
                              multiSelectMode={multiSelectMode}
                              toggleCellSelection={toggleCellSelection}
                              isMobile
                            />
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            {/* 一括編集UI（共通） */}
            {selectedCells.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center gap-2 my-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <span className="text-sm text-blue-800 font-medium">
                  {selectedCells.length}件選択中
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => setIsBulkEditOpen(true)}
                    className="h-8 px-3"
                  >
                    一括編集
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedCells([])}
                    className="h-8 px-3"
                  >
                    選択解除
                  </Button>
                </div>
              </div>
            )}
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-4">
              <div className="text-sm text-muted-foreground text-center sm:text-left">
                <p>※ シフトを登録すると、スタッフのシフト表に反映されます。</p>
                <p>※ 既存のシフトがある場合は上書きされます。</p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
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
                    setValidationWarnings([]);
                    forceUpdate();
                    toast({
                      title: "シフトをクリアしました",
                      description: "全てのシフトをクリアしました。",
                    });
                  }}
                  className="w-full sm:w-auto h-10"
                >
                  <X className="h-4 w-4 mr-2" />
                  クリア
                </Button>
                <Button
                  variant="default"
                  onClick={handleSaveShifts}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm h-12"
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
