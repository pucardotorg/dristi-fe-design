import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { RegisterScreen } from "@/components/employee/register-screen";
import { registerById } from "@/lib/employee/registers";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ registerId: string }>;
}): Promise<Metadata> {
  const register = registerById((await params).registerId);
  return { title: register ? register.name : "Register" };
}

/**
 * `/employee/registers/<id>` — one register. An id that is not one of the eighteen is
 * not found, rather than an empty register with an invented name.
 *
 * Suspense because the screen reads `?view=`, which a dashboard tile sets.
 */
export default async function CourtRegisterPage({
  params,
}: {
  params: Promise<{ registerId: string }>;
}) {
  const { registerId } = await params;
  if (!registerById(registerId)) notFound();
  return (
    <Suspense>
      <RegisterScreen registerId={registerId} />
    </Suspense>
  );
}
