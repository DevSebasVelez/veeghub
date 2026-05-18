import type { Metadata } from "next";

import { LoginForm } from "@/app/login/login-form";

export const metadata: Metadata = {
  title: "Login | Veeghub",
  description: "Acceso administrativo de Veeghub",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-svh bg-background">
      <section className="hidden flex-1 border-r bg-muted/35 px-10 py-8 lg:flex lg:flex-col lg:justify-between">
        <div className="text-sm font-semibold tracking-tight">Veeghub</div>
        <div className="max-w-xl">
          <div className="mb-6 inline-flex rounded-lg border bg-background px-3 py-1 text-sm text-muted-foreground">
            Panel administrativo
          </div>
          <h1 className="text-5xl font-semibold leading-tight tracking-normal">
            Control operativo claro para equipos internos.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
            Accede con tu cuenta autorizada para administrar las herramientas,
            procesos y datos internos de Veeghub.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border bg-background p-3">
            <div className="font-medium">Usuarios</div>
            <div className="mt-1 text-muted-foreground">ADMIN</div>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <div className="font-medium">Acceso</div>
            <div className="mt-1 text-muted-foreground">Privado</div>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <div className="font-medium">Sesión</div>
            <div className="mt-1 text-muted-foreground">JWT</div>
          </div>
        </div>
      </section>

      <section className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 lg:hidden">
            <div className="text-sm font-semibold tracking-tight">Veeghub</div>
            <h1 className="mt-6 text-3xl font-semibold leading-tight tracking-normal">
              Panel administrativo
            </h1>
          </div>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
