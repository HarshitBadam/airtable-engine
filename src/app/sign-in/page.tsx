import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { SignInForm } from "./SignInForm";

export default async function SignInPage() {
  const session = await auth();

  // Redirect to dashboard if already authenticated
  if (session?.user) {
    redirect("/dashboard");
  }

  return <SignInForm />;
}
