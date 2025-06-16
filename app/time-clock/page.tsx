"use client";

import React, { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/contexts/UserContext";
import {
  getTodayAttendance,
  createAttendanceRecord,
  startBreak,
  endBreak,
  clockOut,
  AttendanceRecord,
} from "@/lib/attendance";
import { Clock, Coffee, LogOut } from "lucide-react";
import AppLayout from "@/components/layout/layout";

export default function TimeClockPage() {
  const user = useUser();
  const { toast } = useToast();
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 勤怠データの初期取得
  React.useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    try {
      const todayAttendance = getTodayAttendance(user.id);
      setAttendance(todayAttendance);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const handleClockIn = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "ユーザー情報が見つかりません。再度ログインしてください。",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const newRecord = createAttendanceRecord(user.id);
      setAttendance(newRecord);
      toast({
        title: "出勤しました",
        description: `出勤時間: ${newRecord.clockIn}`,
      });
    } catch (error) {
      console.error("出勤エラー:", error);
      toast({
        variant: "destructive",
        title: "エラー",
        description:
          error instanceof Error ? error.message : "出勤に失敗しました",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBreakStart = async () => {
    if (!user || !attendance) return;

    setIsSubmitting(true);
    try {
      const updatedRecord = startBreak(attendance.id);
      setAttendance(updatedRecord);
      toast({
        title: "休憩開始",
        description: "休憩を開始しました。",
      });
    } catch (error) {
      console.error("休憩開始エラー:", error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "休憩の開始に失敗しました。",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBreakEnd = async () => {
    if (!user || !attendance) return;

    setIsSubmitting(true);
    try {
      const updatedRecord = endBreak(attendance.id);
      setAttendance(updatedRecord);
      toast({
        title: "休憩終了",
        description: "休憩を終了しました。",
      });
    } catch (error) {
      console.error("休憩終了エラー:", error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "休憩の終了に失敗しました。",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClockOut = async () => {
    if (!user || !attendance) return;

    setIsSubmitting(true);
    try {
      const updatedRecord = clockOut(attendance.id);
      setAttendance(updatedRecord);
      toast({
        title: "退勤しました",
        description: "本日の勤務を終了しました。",
      });
    } catch (error) {
      console.error("退勤エラー:", error);
      toast({
        variant: "destructive",
        title: "エラー",
        description: "退勤に失敗しました。",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate break time
  const calculateBreakTime = () => {
    if (!attendance?.breakStart?.length || !attendance?.breakEnd?.length)
      return 0;
    const lastBreakStart =
      attendance.breakStart[attendance.breakStart.length - 1];
    const lastBreakEnd = attendance.breakEnd[attendance.breakEnd.length - 1];
    if (!lastBreakStart || !lastBreakEnd) return 0;
    const start = new Date(`${attendance.date}T${lastBreakStart}`);
    const end = new Date(`${attendance.date}T${lastBreakEnd}`);
    return Math.floor((end.getTime() - start.getTime()) / 1000 / 60);
  };

  // Format time for display
  const formatTime = (time: string | string[] | null | undefined) => {
    if (!time) return "-";
    if (Array.isArray(time)) {
      if (!time.length) return "-";
      const lastTime = time[time.length - 1];
      return new Date(`${attendance?.date}T${lastTime}`).toLocaleTimeString(
        "ja-JP",
        {
          hour: "2-digit",
          minute: "2-digit",
        }
      );
    }
    return new Date(`${attendance?.date}T${time}`).toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isOnBreak = attendance
    ? (attendance as AttendanceRecord).breakStart.length >
      ((attendance as AttendanceRecord).breakEnd.length ?? 0)
    : false;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">勤怠管理</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">出勤時間</p>
                    <p className="text-lg font-medium">
                      {formatTime(attendance?.clockIn)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">退勤時間</p>
                    <p className="text-lg font-medium">
                      {formatTime(attendance?.clockOut)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">休憩開始</p>
                    <p className="text-lg font-medium">
                      {formatTime(attendance?.breakStart)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">休憩終了</p>
                    <p className="text-lg font-medium">
                      {formatTime(attendance?.breakEnd)}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">休憩時間</p>
                  <p className="text-lg font-medium">
                    {attendance?.breakStart && attendance?.breakEnd
                      ? `${calculateBreakTime()}分`
                      : "-"}
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {!attendance || !attendance.clockIn ? (
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleClockIn}
                    disabled={isSubmitting}
                  >
                    <Clock className="mr-2 h-5 w-5" />
                    {isSubmitting ? "処理中..." : "出勤"}
                  </Button>
                ) : !attendance.clockOut ? (
                  <>
                    {!isOnBreak ? (
                      <Button
                        className="w-full"
                        size="lg"
                        onClick={handleBreakStart}
                        disabled={isSubmitting}
                      >
                        <Coffee className="mr-2 h-5 w-5" />
                        {isSubmitting ? "処理中..." : "休憩開始"}
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        size="lg"
                        onClick={handleBreakEnd}
                        disabled={isSubmitting}
                      >
                        <Coffee className="mr-2 h-5 w-5" />
                        {isSubmitting ? "処理中..." : "休憩終了"}
                      </Button>
                    )}
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handleClockOut}
                      disabled={isSubmitting || isOnBreak}
                    >
                      <LogOut className="mr-2 h-5 w-5" />
                      {isSubmitting ? "処理中..." : "退勤"}
                    </Button>
                  </>
                ) : (
                  <div className="text-center text-muted-foreground">
                    本日の勤務は終了しました
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
