import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const runs = await prisma.run.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { workflow: true },
  });
  return NextResponse.json(runs);
}