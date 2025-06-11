"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import {
  getTodayAttendance,
  createAttendanceRecord,
  startBreak,
  endBreak,
  clockOut,
} from "@/lib/attendance";
import { Clock, Coffee, LogOut } from "lucide-react";
import AppLayout from "@/components/layout/layout";

export default function TimeClockPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [attendance, setAttendance] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      router.push("/login");
      return;
    }
    setUser(currentUser);
    loadAttendance(currentUser.id);
  }, [router]);

  const loadAttendance = (userId: string) => {
    const todayAttendance = getTodayAttendance(userId);
    setAttendance(todayAttendance);
  };

  const handleClockIn = async () => {
    const user = getCurrentUser();
    if (!user) return;

    setIsLoading(true);
    try {
      const newRecord = createAttendanceRecord(user.id);
      setAttendance(newRecord);
      toast({
        title: "出勤しました",
        description: "本日の勤務を開始しました。",
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
      setIsLoading(false);
    }
  };

  const handleStartBreak = async () => {
    if (!attendance) return;

    setIsLoading(true);
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
        description:
          error instanceof Error ? error.message : "休憩開始に失敗しました",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndBreak = async () => {
    if (!attendance) return;

    setIsLoading(true);
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
        description:
          error instanceof Error ? error.message : "休憩終了に失敗しました",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!attendance) return;

    setIsLoading(true);
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
        description:
          error instanceof Error ? error.message : "退勤に失敗しました",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (time: string | null) => {
    if (!time) return "--:--";
    return time;
  };

  const isOnBreak =
    attendance?.breakStart?.length > attendance?.breakEnd?.length;

  if (!user) {
    return null;
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-center">
                勤怠打刻
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-sm text-muted-foreground">
                      出勤時間
                    </div>
                    <div className="text-2xl font-bold">
                      {formatTime(attendance?.clockIn)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">
                      退勤時間
                    </div>
                    <div className="text-2xl font-bold">
                      {formatTime(attendance?.clockOut)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col space-y-4">
                  {!attendance ? (
                    <Button
                      size="lg"
                      onClick={handleClockIn}
                      disabled={isLoading}
                      className="w-full"
                    >
                      <Clock className="h-5 w-5 mr-2" />
                      {isLoading ? "処理中..." : "出勤"}
                    </Button>
                  ) : !attendance.clockOut ? (
                    <>
                      {!isOnBreak ? (
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={handleStartBreak}
                          disabled={isLoading}
                          className="w-full"
                        >
                          <Coffee className="h-5 w-5 mr-2" />
                          {isLoading ? "処理中..." : "休憩開始"}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={handleEndBreak}
                          disabled={isLoading}
                          className="w-full"
                        >
                          <Coffee className="h-5 w-5 mr-2" />
                          {isLoading ? "処理中..." : "休憩終了"}
                        </Button>
                      )}
                      <Button
                        size="lg"
                        onClick={handleClockOut}
                        disabled={isLoading || isOnBreak}
                        className="w-full"
                      >
                        <LogOut className="h-5 w-5 mr-2" />
                        {isLoading ? "処理中..." : "退勤"}
                      </Button>
                    </>
                  ) : (
                    <div className="text-center text-muted-foreground">
                      本日の勤務は終了しました
                    </div>
                  )}
                </div>

                {attendance && (
                  <div className="mt-6 pt-6 border-t">
                    <h3 className="text-lg font-semibold mb-4">休憩履歴</h3>
                    <div className="space-y-2">
                      {attendance.breakStart.map(
                        (start: string, index: number) => (
                          <div
                            key={index}
                            className="flex justify-between items-center text-sm"
                          >
                            <span>
                              {start} - {attendance.breakEnd[index] || "休憩中"}
                            </span>
                          </div>
                        )
                      )}
                      {attendance.breakStart.length === 0 && (
                        <div className="text-center text-muted-foreground">
                          休憩履歴はありません
                        </div>
                      )}
                    </div>
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
