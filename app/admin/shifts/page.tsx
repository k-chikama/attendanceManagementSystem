"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { User, getCurrentUser, getAllUsers } from "@/lib/auth";
import {
  Shift,
  createShift,
  updateShift,
  deleteShift,
  getShifts,
} from "@/lib/shifts";
import AppLayout from "@/components/layout/layout";
import { Plus, Pencil, Trash2 } from "lucide-react";

export default function AdminShiftsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<Omit<User, "password"> | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [staff, setStaff] = useState<Omit<User, "password">[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date()
  );
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);

  // 新規シフト作成用の状態
  const [newShift, setNewShift] = useState({
    userId: "",
    date: format(new Date(), "yyyy-MM-dd"),
    startTime: "09:00",
    endTime: "18:00",
    type: "regular" as const,
  });

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const currentUser = getCurrentUser();
        if (!currentUser || currentUser.role !== "admin") {
          router.push("/login");
          return;
        }
        setUser(currentUser);
        const allStaff = getAllUsers().filter((u) => u.role === "staff");
        setStaff(allStaff);
        const shiftsData = getShifts();
        setShifts(shiftsData);
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
  }, [router, toast]);

  const handleCreateShift = async () => {
    if (!newShift.userId || !newShift.date) {
      toast({
        variant: "destructive",
        title: "エラー",
        description: "必須項目を入力してください",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const createdShift = createShift({
        ...newShift,
        date: format(selectedDate || new Date(), "yyyy-MM-dd"),
      });
      setShifts([...shifts, createdShift]);
      setIsCreateDialogOpen(false);
      setNewShift({
        userId: "",
        date: format(new Date(), "yyyy-MM-dd"),
        startTime: "09:00",
        endTime: "18:00",
        type: "regular",
      });
      toast({
        title: "シフトを作成しました",
        description: "新しいシフトが追加されました",
      });
    } catch (error) {
      console.error("シフト作成エラー:", error);
      toast({
        variant: "destructive",
        title: "エラー",
        description:
          error instanceof Error ? error.message : "シフトの作成に失敗しました",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateShift = async () => {
    if (!selectedShift) return;

    setIsSubmitting(true);
    try {
      const updatedShift = updateShift(selectedShift.id, {
        ...selectedShift,
        date: format(selectedDate || new Date(), "yyyy-MM-dd"),
      });
      setShifts(
        shifts.map((s) => (s.id === updatedShift.id ? updatedShift : s))
      );
      setIsEditDialogOpen(false);
      setSelectedShift(null);
      toast({
        title: "シフトを更新しました",
        description: "シフト情報が更新されました",
      });
    } catch (error) {
      console.error("シフト更新エラー:", error);
      toast({
        variant: "destructive",
        title: "エラー",
        description:
          error instanceof Error ? error.message : "シフトの更新に失敗しました",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteShift = async (shiftId: string) => {
    if (!confirm("このシフトを削除してもよろしいですか？")) return;

    setIsSubmitting(true);
    try {
      deleteShift(shiftId);
      setShifts(shifts.filter((s) => s.id !== shiftId));
      toast({
        title: "シフトを削除しました",
        description: "シフトが削除されました",
      });
    } catch (error) {
      console.error("シフト削除エラー:", error);
      toast({
        variant: "destructive",
        title: "エラー",
        description:
          error instanceof Error ? error.message : "シフトの削除に失敗しました",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">シフト管理</h1>
            <Dialog
              open={isCreateDialogOpen}
              onOpenChange={setIsCreateDialogOpen}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  新規シフト作成
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>新規シフト作成</DialogTitle>
                  <DialogDescription>
                    新しいシフトを作成します。必須項目を入力してください。
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="staff">スタッフ</Label>
                    <Select
                      value={newShift.userId}
                      onValueChange={(value) =>
                        setNewShift({ ...newShift, userId: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="スタッフを選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {staff.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>日付</Label>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      locale={ja}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="startTime">開始時間</Label>
                      <Input
                        id="startTime"
                        type="time"
                        value={newShift.startTime}
                        onChange={(e) =>
                          setNewShift({
                            ...newShift,
                            startTime: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="endTime">終了時間</Label>
                      <Input
                        id="endTime"
                        type="time"
                        value={newShift.endTime}
                        onChange={(e) =>
                          setNewShift({ ...newShift, endTime: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="type">シフト種別</Label>
                    <Select
                      value={newShift.type}
                      onValueChange={(value: "regular" | "overtime") =>
                        setNewShift({ ...newShift, type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="シフト種別を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="regular">通常勤務</SelectItem>
                        <SelectItem value="overtime">残業</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    キャンセル
                  </Button>
                  <Button onClick={handleCreateShift} disabled={isSubmitting}>
                    {isSubmitting ? "作成中..." : "作成"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {shifts.map((shift) => {
              const staffMember = staff.find((s) => s.id === shift.userId);
              return (
                <Card key={shift.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>
                          {staffMember?.name || "不明なスタッフ"}
                        </CardTitle>
                        <CardDescription>
                          {format(new Date(shift.date), "yyyy年MM月dd日", {
                            locale: ja,
                          })}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Dialog
                          open={
                            isEditDialogOpen && selectedShift?.id === shift.id
                          }
                          onOpenChange={(open) => {
                            setIsEditDialogOpen(open);
                            if (!open) setSelectedShift(null);
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => setSelectedShift(shift)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>シフト編集</DialogTitle>
                              <DialogDescription>
                                シフト情報を編集します。
                              </DialogDescription>
                            </DialogHeader>
                            {selectedShift && (
                              <>
                                <div className="grid gap-4 py-4">
                                  <div className="grid gap-2">
                                    <Label>スタッフ</Label>
                                    <Select
                                      value={selectedShift.userId}
                                      onValueChange={(value) =>
                                        setSelectedShift({
                                          ...selectedShift,
                                          userId: value,
                                        })
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="スタッフを選択" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {staff.map((s) => (
                                          <SelectItem key={s.id} value={s.id}>
                                            {s.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="grid gap-2">
                                    <Label>日付</Label>
                                    <Calendar
                                      mode="single"
                                      selected={new Date(selectedShift.date)}
                                      onSelect={(date) => setSelectedDate(date)}
                                      locale={ja}
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                      <Label htmlFor="editStartTime">
                                        開始時間
                                      </Label>
                                      <Input
                                        id="editStartTime"
                                        type="time"
                                        value={selectedShift.startTime}
                                        onChange={(e) =>
                                          setSelectedShift({
                                            ...selectedShift,
                                            startTime: e.target.value,
                                          })
                                        }
                                      />
                                    </div>
                                    <div className="grid gap-2">
                                      <Label htmlFor="editEndTime">
                                        終了時間
                                      </Label>
                                      <Input
                                        id="editEndTime"
                                        type="time"
                                        value={selectedShift.endTime}
                                        onChange={(e) =>
                                          setSelectedShift({
                                            ...selectedShift,
                                            endTime: e.target.value,
                                          })
                                        }
                                      />
                                    </div>
                                  </div>
                                  <div className="grid gap-2">
                                    <Label htmlFor="editType">シフト種別</Label>
                                    <Select
                                      value={selectedShift.type}
                                      onValueChange={(
                                        value: "regular" | "overtime"
                                      ) =>
                                        setSelectedShift({
                                          ...selectedShift,
                                          type: value,
                                        })
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="シフト種別を選択" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="regular">
                                          通常勤務
                                        </SelectItem>
                                        <SelectItem value="overtime">
                                          残業
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setIsEditDialogOpen(false);
                                      setSelectedShift(null);
                                    }}
                                  >
                                    キャンセル
                                  </Button>
                                  <Button
                                    onClick={handleUpdateShift}
                                    disabled={isSubmitting}
                                  >
                                    {isSubmitting ? "更新中..." : "更新"}
                                  </Button>
                                </DialogFooter>
                              </>
                            )}
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDeleteShift(shift.id)}
                          disabled={isSubmitting}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          開始時間
                        </p>
                        <p className="text-lg font-medium">{shift.startTime}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          終了時間
                        </p>
                        <p className="text-lg font-medium">{shift.endTime}</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-sm text-muted-foreground">
                        シフト種別
                      </p>
                      <p className="text-lg font-medium">
                        {shift.type === "regular" ? "通常勤務" : "残業"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
