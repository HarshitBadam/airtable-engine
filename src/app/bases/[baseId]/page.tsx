import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ baseId: string }>;
};

export default async function BasePage({ params }: PageProps) {
  const { baseId } = await params;
  redirect(`/bases/${baseId}/tables/default`);
}
