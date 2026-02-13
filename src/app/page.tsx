import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { SignInForm } from "./sign-in/SignInForm";

export const metadata: Metadata = {
  title: "Sign in - Airtable",
};

export default async function Home() {
  const session = await auth();

  // Redirect to dashboard if already authenticated
  if (session?.user) {
    redirect("/dashboard");
  }

  return <SignInForm />;
}
