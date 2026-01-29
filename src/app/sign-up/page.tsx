import { redirect } from "next/navigation";
import { auth } from "~/server/auth";
import { SignUpForm } from "./SignUpForm";

export default async function SignUpPage() {
  const session = await auth();

  // Redirect to dashboard if already authenticated
  if (session?.user) {
    redirect("/dashboard");
  }

  return <SignUpForm />;
}
