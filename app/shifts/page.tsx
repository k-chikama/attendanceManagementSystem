"use client";

import { useState, useEffect } from "react";
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
import { getAllUsers } from "@/lib/firestoreUsers";
import { getAllShifts } from "@/lib/firestoreShifts";
import AppLayout from "@/components/layout/layout";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { cn } from "@/lib/utils";

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

function ShiftBadge({ type }: { type: string | undefined }) {
  if (!type) return <span className="text-muted-foreground">-</span>;

  let color = "bg-slate-200 text-slate-800";
  if (type === "休み") color = "bg-slate-200 text-slate-800";
  if (type === "早番") color = "bg-sky-200 text-sky-800";
  if (type === "遅番") color = "bg-violet-200 text-violet-800";
  if (type === "AL") color = "bg-emerald-200 text-emerald-800";
  if (type === "残業") color = "bg-orange-200 text-orange-800";

  return (
    <span
      className={`inline-block px-2 py-1 rounded text-xs font-medium min-w-[40px] ${color}`}
    >
      {type}
    </span>
  );
}

export default function ShiftsPage() {
  const user = useUser();
  const { toast } = useToast();
  const [shifts, setShifts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        if (!user) return;
        const usersFromFirestore = await getAllUsers();
        setUsers(usersFromFirestore);
        const allShifts = await getAllShifts();
        setShifts(allShifts);
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
  };

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
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
      <div className="container mx-auto py-4 px-2 sm:py-8 sm:px-6 lg:px-8">
        <div className="w-full space-y-4">
          <Card className="w-full max-w-none">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between mb-4 w-full">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePrevMonth}
                  className="shrink-0 h-10 w-10"
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
                  className="shrink-0 h-10 w-10"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* PC用テーブル */}
              <div className="overflow-x-auto w-full hidden sm:block">
                <table className="min-w-[1200px] w-full border text-center text-xs align-middle">
                  <thead className="sticky top-0 z-20">
                    <tr>
                      <th className="border bg-muted px-3 py-2 sticky left-0 z-10 text-left min-w-[120px] font-bold">
                        スタッフ
                      </th>
                      {monthDates.map(({ display, day }, i) => (
                        <th
                          key={i}
                          className="border bg-muted px-2 py-2 text-xs font-normal min-w-[60px] text-center"
                        >
                          <div className="flex flex-col items-center">
                            <span className="font-bold">{display}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {day}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((member) => (
                      <tr key={member.uid} className="h-12">
                        <td className="border bg-background sticky left-0 z-10 text-left font-bold px-3 py-2 min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold">
                                {member.name.charAt(0)}
                              </span>
                            </div>
                            <span className="text-sm">{member.name}</span>
                          </div>
                        </td>
                        {monthDates.map(({ date }, dayIdx) => {
                          const shift = findShift(member.uid, date);
                          return (
                            <td
                              key={dayIdx}
                              className="border px-2 py-2 align-middle min-w-[60px]"
                            >
                              <ShiftBadge
                                type={getShiftTypeLabel(
                                  shift ? shift.type : undefined
                                )}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* スマホ用テーブル */}
              <div className="block sm:hidden w-full overflow-x-auto -mx-2 px-2">
                <div className="rounded-lg shadow-sm border bg-white min-w-max">
                  <table className="border-collapse text-center text-xs align-middle">
                    <thead className="bg-gray-50 sticky top-0 z-20">
                      <tr>
                        <th className="w-16 sticky left-0 z-30 bg-gray-50 font-bold text-xs py-3 px-2 border-r border-b">
                          日付
                        </th>
                        {users.map((member) => (
                          <th
                            key={member.uid}
                            className="border-b bg-gray-50 font-bold text-xs px-2 py-3 min-w-[65px] max-w-[65px]"
                          >
                            <div className="flex flex-col items-center space-y-0.5">
                              <span className="font-bold text-xs truncate w-full">
                                {member.name}
                              </span>
                              <span className="text-[9px] text-muted-foreground truncate w-full">
                                {member.department || ""}
                              </span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {monthDates.map(({ date, display, day }, i) => {
                        const isSpecial =
                          getDay(parseISO(date)) === 0 ||
                          getDay(parseISO(date)) === 6;
                        return (
                          <tr key={date} className="h-16">
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
                                  {display}
                                </span>
                                <span className="text-[9px] text-muted-foreground">
                                  {day}
                                </span>
                              </div>
                            </td>
                            {users.map((member) => {
                              const shift = findShift(member.uid, date);
                              return (
                                <td
                                  key={member.uid}
                                  className="border px-1 py-2 align-middle min-w-[65px] h-16"
                                >
                                  <div className="flex items-center justify-center h-full">
                                    <ShiftBadge
                                      type={getShiftTypeLabel(
                                        shift ? shift.type : undefined
                                      )}
                                    />
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
