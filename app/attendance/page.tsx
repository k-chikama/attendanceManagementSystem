"use client";

import { useState, useEffect } from "react";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  parseISO,
  isWeekend,
} from "date-fns";
import { ja } from "date-fns/locale";
import {
  Calendar,
  Clock,
  Clock3,
  Briefcase,
  Coffee,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useUser } from "@/contexts/UserContext";
import { AttendanceRecord, getUserAttendance } from "@/lib/attendance";
import AppLayout from "@/components/layout/layout";

export default function AttendancePage() {
  const user = useUser();
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [filteredRecords, setFilteredRecords] = useState<AttendanceRecord[]>(
    []
  );

  // Load attendance data
  useEffect(() => {
    if (!user) return;
    const attendance = getUserAttendance(user.id);
    setAttendanceData(attendance);
  }, [user]);

  // Filter records when month changes
  useEffect(() => {
    if (attendanceData.length > 0) {
      const startDate = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
      const endDate = format(endOfMonth(selectedMonth), "yyyy-MM-dd");

      const filtered = attendanceData.filter((record) => {
        return record.date >= startDate && record.date <= endDate;
      });

      setFilteredRecords(filtered);
    }
  }, [attendanceData, selectedMonth]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Get all days in the selected month
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(selectedMonth),
    end: endOfMonth(selectedMonth),
  });

  // Handle month change
  const handleMonthChange = (value: string) => {
    const [year, month] = value.split("-").map(Number);
    const newDate = new Date(year, month - 1, 1);
    setSelectedMonth(newDate);
  };

  // Generate month options for select
  const getMonthOptions = () => {
    const options = [];
    const currentYear = new Date().getFullYear();

    for (let year = currentYear; year >= currentYear - 1; year--) {
      for (let month = 12; month >= 1; month--) {
        // Skip future months
        if (year === currentYear && month > new Date().getMonth() + 1) continue;

        const value = `${year}-${month.toString().padStart(2, "0")}`;
        const label = `${year}年${month}月`;
        options.push({ value, label });
      }
    }

    return options;
  };

  // Get status badge for attendance record
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "present":
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200"
          >
            出勤
          </Badge>
        );
      case "late":
        return (
          <Badge
            variant="outline"
            className="bg-amber-50 text-amber-700 border-amber-200"
          >
            遅刻
          </Badge>
        );
      case "absent":
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 border-red-200"
          >
            欠勤
          </Badge>
        );
      case "leave":
        return (
          <Badge
            variant="outline"
            className="bg-blue-50 text-blue-700 border-blue-200"
          >
            休暇
          </Badge>
        );
      case "holiday":
        return (
          <Badge
            variant="outline"
            className="bg-purple-50 text-purple-700 border-purple-200"
          >
            休日
          </Badge>
        );
      default:
        return null;
    }
  };

  // Format total work time
  const formatWorkTime = (minutes: number | null) => {
    if (!minutes) return "0h 0m";

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    return `${hours}h ${mins}m`;
  };

  // Format break times as a string
  const formatBreakTimes = (starts: string[], ends: string[]) => {
    if (!starts || !ends || starts.length === 0 || ends.length === 0)
      return "-";

    const breakCount = Math.min(starts.length, ends.length);
    const breakStrings = [];
    for (let i = 0; i < breakCount; i++) {
      if (starts[i] && ends[i]) {
        breakStrings.push(`${starts[i]}〜${ends[i]}`);
      }
    }

    return breakStrings.length > 0 ? breakStrings.join(", ") : "-";
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">勤怠記録</h1>
            <p className="text-muted-foreground">
              過去の勤務時間と打刻記録を確認できます。
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <Select
              defaultValue={`${format(selectedMonth, "yyyy-MM")}`}
              onValueChange={handleMonthChange}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="月を選択" />
              </SelectTrigger>
              <SelectContent>
                {getMonthOptions().map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">
                {format(selectedMonth, "yyyy年M月", { locale: ja })}{" "}
                の勤怠サマリー
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="flex flex-col border rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Briefcase className="h-4 w-4" />
                    勤務日数
                  </div>
                  <div className="text-2xl font-bold">
                    {
                      filteredRecords.filter(
                        (r) => r.status === "present" || r.status === "late"
                      ).length
                    }
                    日
                  </div>
                </div>

                <div className="flex flex-col border rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Clock className="h-4 w-4" />
                    総勤務時間
                  </div>
                  <div className="text-2xl font-bold">
                    {formatWorkTime(
                      filteredRecords.reduce(
                        (sum, r) => sum + (r.totalWorkTime || 0),
                        0
                      )
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    平均:{" "}
                    {formatWorkTime(
                      filteredRecords.filter(
                        (r) => r.status === "present" || r.status === "late"
                      ).length > 0
                        ? filteredRecords.reduce(
                            (sum, r) => sum + (r.totalWorkTime || 0),
                            0
                          ) /
                            filteredRecords.filter(
                              (r) =>
                                r.status === "present" || r.status === "late"
                            ).length
                        : 0
                    )}{" "}
                    / 日
                  </div>
                </div>

                <div className="flex flex-col border rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Coffee className="h-4 w-4" />
                    総休憩時間
                  </div>
                  <div className="text-2xl font-bold">
                    {formatWorkTime(
                      filteredRecords.reduce(
                        (sum, r) => sum + (r.totalWorkTime || 0),
                        0
                      )
                    )}
                  </div>
                </div>

                <div className="flex flex-col border rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <AlertTriangle className="h-4 w-4" />
                    遅刻日数
                  </div>
                  <div className="text-2xl font-bold">
                    {filteredRecords.filter((r) => r.status === "late").length}{" "}
                    日
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-medium">勤怠詳細</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日付</TableHead>
                      <TableHead>出勤</TableHead>
                      <TableHead>退勤</TableHead>
                      <TableHead className="hidden md:table-cell">
                        休憩
                      </TableHead>
                      <TableHead>勤務時間</TableHead>
                      <TableHead>状態</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {daysInMonth.map((day) => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const record = filteredRecords.find(
                        (r) => r.date === dateStr
                      );
                      const isWeekendDay = isWeekend(day);

                      return (
                        <TableRow
                          key={dateStr}
                          className={isWeekendDay ? "bg-muted/50" : ""}
                        >
                          <TableCell className="font-medium">
                            {format(day, "M/d (EEE)", { locale: ja })}
                          </TableCell>
                          <TableCell>{record?.clockIn || "-"}</TableCell>
                          <TableCell>{record?.clockOut || "-"}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            {record?.breakStart ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 text-xs"
                                    >
                                      {record.breakStart.length}回
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>
                                      {formatBreakTimes(
                                        record.breakStart,
                                        record.breakEnd
                                      )}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell>
                            {record?.totalWorkTime
                              ? formatWorkTime(record.totalWorkTime)
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {record ? (
                              getStatusBadge(record.status)
                            ) : isWeekendDay ? (
                              <Badge
                                variant="outline"
                                className="bg-purple-50 text-purple-700 border-purple-200"
                              >
                                休日
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-slate-50 text-slate-700 border-slate-200"
                              >
                                未登録
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
