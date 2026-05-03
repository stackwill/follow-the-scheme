"use server";

import { revalidatePath } from "next/cache";

export async function importBenchmarkPaper(formData: FormData) {
  const year = Number(formData.get("year"));

  if (year !== 2023 && year !== 2024) {
    throw new Error("Unsupported benchmark year");
  }

  const { importAqaPhysicsPaper1HigherBenchmark } = await import("@/lib/import/core/import-paper");

  await importAqaPhysicsPaper1HigherBenchmark(year);
  revalidatePath("/");
  revalidatePath("/dev/imports");
}
