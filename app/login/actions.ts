"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/auth";

export type LoginFormState = {
  error?: string;
};

export async function login(
  _state: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Ingresa tu correo y contraseña para continuar." };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/admin",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Credenciales inválidas o usuario sin acceso." };
    }

    throw error;
  }

  return {};
}
