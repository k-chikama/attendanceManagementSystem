"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isToday,
  parseISO,
  getDay,
} from "date-fns";
import { ja } from "date-fns/locale";
import { User, getAllUsers } from "@/lib/auth";
import { getShiftsByUser, updateShifts } from "@/lib/firestoreShifts";
import AppLayout from "@/components/layout/layout";
import { ChevronLeft, ChevronRight, Check, X } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// シフト種別を日本語ラベルに変換
function getShiftTypeLabel(type: string | undefined): string | undefined {
  switch (type) {
    case "early":
      return "早番";
    case "late":
      return "遅番";
    case "dayoff":
      return "休み";
    case "al":
      return "AL";
    case "overtime":
      return "残業";
    default:
      return undefined;
  }
}

// シフト種別の選択肢
const shiftTypes = [
  { value: "early", label: "早番" },
  { value: "late", label: "遅番" },
  { value: "dayoff", label: "休み" },
  { value: "al", label: "AL" },
  { value: "overtime", label: "残業" },
];

function ShiftBadge({
  type,
  isSelected,
  onClick,
}: {
  type: string | undefined;
  isSelected?: boolean;
  onClick?: () => void;
}) {
  if (!type) return <span className="text-muted-foreground">-</span>;
  let color = "bg-gray-100 text-gray-700";
  if (type === "休み") color = "bg-gray-200 text-gray-500";
  if (type === "早番") color = "bg-blue-100 text-blue-700";
  if (type === "遅番") color = "bg-purple-100 text-purple-700";
  if (type === "AL") color = "bg-green-100 text-green-700";
  if (type === "残業") color = "bg-purple-100 text-purple-700";

  return (
    <span
      className={`inline-block px-2 py-1 rounded text-xs font-medium min-w-[40px] cursor-pointer transition-colors ${color} ${
        isSelected ? "ring-2 ring-primary ring-offset-2" : ""
      }`}
      onClick={onClick}
    >
      {type}
    </span>
  );
}

type SelectedShift = {
  userId: string;
  date: string;
};

export default function ShiftsPage() {
  const user = useUser();
  const { toast } = useToast();
  const [shifts, setShifts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedShifts, setSelectedShifts] = useState<SelectedShift[]>([]);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedShiftType, setSelectedShiftType] = useState<string>("");

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        if (!user) return;
        setUsers(getAllUsers());
        const userShifts = await getShiftsByUser(user.id);
        setShifts(userShifts);
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
  }, [user, toast]);

  // 月の日付を生成
  const monthDates = useState(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end }).map((date) => ({
      date: format(date, "yyyy-MM-dd"),
      display: format(date, "M/d", { locale: ja }),
      day: format(date, "E", { locale: ja }),
    }));
  })[0];

  // 日付×ユーザーごとに該当シフトを取得
  function findShift(userId: string, date: string): any | undefined {
    return shifts.find(
      (shift) => shift.userId === userId && shift.date === date
    );
  }

  const handlePrevMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
    setSelectedShifts([]); // 月が変わったら選択をリセット
  };

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
    setSelectedShifts([]); // 月が変わったら選択をリセット
  };

  const toggleShiftSelection = (userId: string, date: string) => {
    setSelectedShifts((prev) => {
      const existing = prev.find((s) => s.userId === userId && s.date === date);
      if (existing) {
        return prev.filter((s) => !(s.userId === userId && s.date === date));
      }
      return [...prev, { userId, date }];
    });
  };

  const handleBulkEdit = async () => {
    if (!selectedShiftType || selectedShifts.length === 0) return;

    setIsLoading(true);
    try {
      const updates = selectedShifts.map(({ userId, date }) => ({
        userId,
        date,
        type: selectedShiftType,
      }));

      await updateShifts(updates);

      // ローカルの状態も更新
      setShifts((prev) => {
        const newShifts = [...prev];
        updates.forEach((update) => {
          const index = newShifts.findIndex(
            (s) => s.userId === update.userId && s.date === update.date
          );
          if (index >= 0) {
            newShifts[index] = { ...newShifts[index], type: update.type };
          } else {
            newShifts.push(update);
          }
        });
        return newShifts;
      });

      toast({
        title: "シフトを更新しました",
        description: `${selectedShifts.length}件のシフトを更新しました。`,
      });

      setSelectedShifts([]);
      setIsEditDialogOpen(false);
      setSelectedShiftType("");
    } catch (error) {
      console.error("シフト更新エラー:", error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "シフトの更新に失敗しました",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="w-full py-4 px-0">
        <div className="w-full space-y-4">
          <Card className="w-full max-w-none">
            <CardHeader className="w-full">
              <div className="flex items-center justify-between mb-4 w-full">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePrevMonth}
                  className="shrink-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <CardTitle className="text-center text-lg sm:text-2xl font-bold tracking-tight">
                  {format(currentDate, "yyyy年M月", { locale: ja })}のシフト表
                </CardTitle>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleNextMonth}
                  className="shrink-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              {selectedShifts.length > 0 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    {selectedShifts.length}件選択中
                  </div>
                  <div className="space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedShifts([])}
                    >
                      <X className="h-4 w-4 mr-2" />
                      選択解除
                    </Button>
                    <Button size="sm" onClick={() => setIsEditDialogOpen(true)}>
                      <Check className="h-4 w-4 mr-2" />
                      一括編集
                    </Button>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto w-full">
                <table className="min-w-[1800px] w-full border text-center text-xs align-middle">
                  <thead className="sticky top-0 z-20">
                    <tr>
                      <th className="border bg-muted px-1.5 py-1 sticky left-0 z-10 text-left min-w-[100px]">
                        スタッフ
                      </th>
                      {monthDates.map(({ display, day }, i) => (
                        <th
                          key={i}
                          className="border bg-muted px-1.5 py-1 text-[11px] font-normal min-w-[48px] text-center"
                        >
                          <div className="flex flex-col items-center">
                            <span>{display}</span>
                            <span className="text-[9px] text-muted-foreground">
                              ({day})
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((member) => (
                      <tr key={member.id}>
                        <td className="border bg-background sticky left-0 z-10 text-left font-bold px-1.5 py-1 min-w-[100px]">
                          {member.name}
                        </td>
                        {monthDates.map(({ date }, dayIdx) => {
                          const shift = findShift(member.id, date);
                          const isSelected = selectedShifts.some(
                            (s) => s.userId === member.id && s.date === date
                          );
                          return (
                            <td
                              key={dayIdx}
                              className="border px-1 py-1 align-middle min-w-[48px]"
                            >
                              <ShiftBadge
                                type={getShiftTypeLabel(
                                  shift ? shift.type : undefined
                                )}
                                isSelected={isSelected}
                                onClick={() =>
                                  toggleShiftSelection(member.id, date)
                                }
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>シフトの一括編集</DialogTitle>
            <DialogDescription>
              選択した{selectedShifts.length}件のシフトを一括で編集します。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select
              value={selectedShiftType}
              onValueChange={setSelectedShiftType}
            >
              <SelectTrigger>
                <SelectValue placeholder="シフト種別を選択" />
              </SelectTrigger>
              <SelectContent>
                {shiftTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={isLoading}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleBulkEdit}
              disabled={!selectedShiftType || isLoading}
            >
              {isLoading ? "更新中..." : "更新"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
