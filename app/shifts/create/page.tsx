"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AppLayout from "@/components/layout/layout";

export default function CreateShiftPage() {
  const router = useRouter();

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== "admin") {
      router.push("/shifts");
    }
  }, [router]);

  return (
    <AppLayout>
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <p className="text-center text-muted-foreground">
            このページにはアクセスできません。
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
