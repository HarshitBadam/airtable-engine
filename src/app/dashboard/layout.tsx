import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "Airtable",
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
