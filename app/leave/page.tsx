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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { CalendarIcon, ArrowLeft } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth";
import {
  createLeaveRequest,
  getUserLeaveRequests,
  validateLeaveRequest,
  calculateLeaveDays,
  type LeaveRequest,
} from "@/lib/leave";
import AppLayout from "@/components/layout/layout";
import { useUser } from "@/contexts/UserContext";

const formSchema = z.object({
  type: z.enum(["有給休暇", "特別休暇", "慶弔休暇", "その他"]),
  startDate: z.date({
    required_error: "開始日を選択してください",
  }),
  endDate: z.date({
    required_error: "終了日を選択してください",
  }),
  reason: z.string().min(1, "申請理由を入力してください"),
});

export default function LeavePage() {
  const user = useUser();
  const { toast } = useToast();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "有給休暇",
      reason: "",
    },
  });

  useEffect(() => {
    if (!user) return;
    setRequests(getUserLeaveRequests(user.id));
  }, [user]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) return;

    try {
      setIsSubmitting(true);

      // バリデーション
      const validationError = validateLeaveRequest({
        startDate: values.startDate.toISOString(),
        endDate: values.endDate.toISOString(),
        type: values.type,
        reason: values.reason,
      });

      if (validationError) {
        toast({
          variant: "destructive",
          title: "エラー",
          description: validationError,
        });
        return;
      }

      // 休暇申請を作成
      const newRequest = createLeaveRequest({
        userId: user.id,
        type: values.type,
        startDate: values.startDate.toISOString(),
        endDate: values.endDate.toISOString(),
        reason: values.reason,
      });

      // 申請一覧を更新
      setRequests((prev) => [...prev, newRequest]);

      toast({
        title: "申請が完了しました",
        description: "休暇申請が正常に送信されました。",
      });

      // フォームをリセット
      form.reset();
    } catch (error) {
      console.error("申請エラー:", error);
      toast({
        variant: "destructive",
        title: "エラー",
        description:
          error instanceof Error ? error.message : "申請に失敗しました",
      });
    } finally {
      setIsSubmitting(false);
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
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>休暇申請</CardTitle>
                <CardDescription>
                  休暇の申請を行います。申請内容を入力してください。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-6"
                  >
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>休暇の種類</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="休暇の種類を選択" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="有給休暇">有給休暇</SelectItem>
                              <SelectItem value="特別休暇">特別休暇</SelectItem>
                              <SelectItem value="慶弔休暇">慶弔休暇</SelectItem>
                              <SelectItem value="その他">その他</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>開始日</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "w-full pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value, "PPP", { locale: ja })
                                    ) : (
                                      <span>日付を選択</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-auto p-0"
                                align="start"
                              >
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) =>
                                    date < new Date() ||
                                    date >
                                      new Date(
                                        new Date().setMonth(
                                          new Date().getMonth() + 3
                                        )
                                      )
                                  }
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="endDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>終了日</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "w-full pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value, "PPP", { locale: ja })
                                    ) : (
                                      <span>日付を選択</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-auto p-0"
                                align="start"
                              >
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) =>
                                    date < new Date() ||
                                    date >
                                      new Date(
                                        new Date().setMonth(
                                          new Date().getMonth() + 3
                                        )
                                      )
                                  }
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="reason"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>申請理由</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="申請理由を入力してください"
                              className="resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "申請中..." : "申請する"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>申請履歴</CardTitle>
                <CardDescription>
                  過去の休暇申請の履歴を表示します。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {requests.length === 0 ? (
                    <p className="text-center text-muted-foreground">
                      申請履歴はありません
                    </p>
                  ) : (
                    requests
                      .sort(
                        (a, b) =>
                          new Date(b.createdAt).getTime() -
                          new Date(a.createdAt).getTime()
                      )
                      .map((request) => (
                        <div
                          key={request.id}
                          className="flex flex-col space-y-2 rounded-lg border p-4"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium">
                                {request.type}
                              </span>
                              <span
                                className={cn(
                                  "rounded-full px-2 py-1 text-xs",
                                  request.status === "approved"
                                    ? "bg-green-100 text-green-800"
                                    : request.status === "rejected"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-yellow-100 text-yellow-800"
                                )}
                              >
                                {request.status === "approved"
                                  ? "承認済み"
                                  : request.status === "rejected"
                                  ? "却下"
                                  : "承認待ち"}
                              </span>
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {format(
                                new Date(request.createdAt),
                                "yyyy/MM/dd",
                                {
                                  locale: ja,
                                }
                              )}
                            </span>
                          </div>
                          <div className="text-sm">
                            <p>
                              期間:{" "}
                              {format(
                                new Date(request.startDate),
                                "yyyy/MM/dd",
                                {
                                  locale: ja,
                                }
                              )}{" "}
                              〜{" "}
                              {format(new Date(request.endDate), "yyyy/MM/dd", {
                                locale: ja,
                              })}
                              （
                              {calculateLeaveDays(
                                request.startDate,
                                request.endDate
                              )}
                              日間）
                            </p>
                            <p className="mt-1 text-muted-foreground">
                              {request.reason}
                            </p>
                          </div>
                          {request.comment && (
                            <div className="mt-2 rounded bg-muted p-2 text-sm">
                              <p className="font-medium">コメント:</p>
                              <p className="mt-1">{request.comment}</p>
                            </div>
                          )}
                        </div>
                      ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
