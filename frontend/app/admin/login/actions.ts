"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

export async function loginAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  try {
    await signIn("credentials", {
      username: formData.get("username"),
      password: formData.get("password"),
      redirectTo: "/admin/dashboard",
    });
    return null;
  } catch (error) {
    if (error instanceof AuthError) {
      return "Invalid username or password.";
    }
    throw error; // re-throw NEXT_REDIRECT so Next.js handles it
  }
}
