"use client";

import AppLayout from "@/components/layout/layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import React from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
} from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

// モック従業員データ
const employees = [
  { id: "1", name: "佐藤 公子" },
  { id: "2", name: "鈴木 太郎" },
  { id: "3", name: "高橋 三朗" },
  { id: "4", name: "真鍋 孝美" },
  { id: "5", name: "里山 悠子" },
];

// シフトの種類
const shiftTypes = ["早番", "遅番", "休み", "MTG"] as const;
type ShiftType = (typeof shiftTypes)[number];

// モックシフトデータ生成関数
function generateMockShiftData(
  monthDates: string[]
): Record<string, Record<string, ShiftType>> {
  const shiftData: Record<string, Record<string, ShiftType>> = {};

  employees.forEach((emp) => {
    shiftData[emp.id] = {};
    monthDates.forEach((date) => {
      // ランダムにシフトを割り当て
      const randomIndex = Math.floor(Math.random() * shiftTypes.length);
      shiftData[emp.id][date] = shiftTypes[randomIndex];
    });
  });

  return shiftData;
}

function ShiftBadge({ type }: { type: string }) {
  let color = "bg-gray-200 text-gray-700";
  if (type === "休み") color = "bg-blue-100 text-blue-700";
  if (type === "早番") color = "bg-yellow-100 text-yellow-700";
  if (type === "遅番") color = "bg-purple-100 text-purple-700";
  if (type === "MTG") color = "bg-orange-100 text-orange-700";
  return (
    <span
      className={`inline-block px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full text-xs font-bold ${color}`}
    >
      {type}
    </span>
  );
}

export default function ShiftsPage() {
  const [currentDate, setCurrentDate] = React.useState(new Date());

  // 月の日付を生成
  const monthDates = React.useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end }).map((date) => ({
      date: format(date, "M/d", { locale: ja }),
      day: format(date, "E", { locale: ja }),
    }));
  }, [currentDate]);

  // シフトデータを生成
  const shiftTable = React.useMemo(
    () => generateMockShiftData(monthDates.map((d) => `${d.date}(${d.day})`)),
    [monthDates]
  );

  const handlePrevMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between mb-4">
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
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full border text-center text-sm">
                <thead>
                  <tr>
                    <th className="border px-2 py-1 sm:px-3 sm:py-2 bg-muted whitespace-nowrap sticky left-0 z-10">
                      日付
                    </th>
                    {employees.map((emp) => (
                      <th
                        key={emp.id}
                        className="border px-2 py-1 sm:px-3 sm:py-2 bg-muted whitespace-nowrap min-w-[100px]"
                      >
                        {emp.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthDates.map(({ date, day }) => (
                    <tr key={`${date}(${day})`}>
                      <td className="border px-2 py-1 sm:px-3 sm:py-2 font-semibold bg-muted/50 whitespace-nowrap sticky left-0 z-10">
                        <div className="flex flex-col">
                          <span className="text-sm">{date}</span>
                          <span className="text-xs text-muted-foreground">
                            ({day})
                          </span>
                        </div>
                      </td>
                      {employees.map((emp) => (
                        <td
                          key={emp.id}
                          className="border px-1 py-1 sm:px-2 sm:py-2"
                        >
                          <ShiftBadge
                            type={
                              shiftTable[emp.id]?.[`${date}(${day})`] || "-"
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
