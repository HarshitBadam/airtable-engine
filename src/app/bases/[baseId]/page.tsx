type PageProps = {
  params: Promise<{ baseId: string }>;
};

export default async function BasePage({ params }: PageProps) {
  const { baseId } = await params;

  return (
    <div>
      <h1>Base page coming soon</h1>
      <p>Base ID: {baseId}</p>
    </div>
  );
}
