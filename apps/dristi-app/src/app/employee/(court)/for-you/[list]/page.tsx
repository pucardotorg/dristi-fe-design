import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ForYouListScreen } from "@/components/employee/for-you-lists";
import { forYouListBySlug } from "@/lib/employee/for-you-lists";

export async function generateMetadata({ params }: { params: Promise<{ list: string }> }): Promise<Metadata> {
  return { title: forYouListBySlug((await params).list)?.title ?? "Dashboard" };
}

/**
 * `/employee/for-you/<list>` — one of the magistrate's lists from the dashboard's "For
 * you" tab, in full: the card's "See all". A slug that is not one of the four is not found.
 */
export default async function ForYouListPage({ params }: { params: Promise<{ list: string }> }) {
  const list = forYouListBySlug((await params).list);
  if (!list) notFound();
  return <ForYouListScreen id={list.id} />;
}
