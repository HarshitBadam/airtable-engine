import ClientPage from "./ClientPage";

type PageProps = {
  params: Promise<{ tableId: string }>;
};

export default async function Page({ params }: PageProps) {
  const { tableId } = await params;
  return <ClientPage tableId={tableId} />;
}
