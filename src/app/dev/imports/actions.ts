"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function importBenchmarkPaper(formData: FormData) {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_IMPORTS !== "true") {
    throw new Error("Developer imports are disabled in production.");
  }

  const year = Number(formData.get("year"));

  if (year !== 2023 && year !== 2024) {
    throw new Error("Unsupported benchmark year");
  }

  const { importAqaPhysicsPaper1HigherBenchmark } = await import("@/lib/import/core/import-paper");

  try {
    await importAqaPhysicsPaper1HigherBenchmark(year);
    revalidatePath("/");
    revalidatePath("/dev/imports");
  } catch {
    revalidatePath("/dev/imports");
  }

  redirect("/dev/imports");
}
