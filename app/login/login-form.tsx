"use client";

import { useActionState } from "react";
import { AlertCircle, Loader2, LockKeyhole, Mail } from "lucide-react";

import { login, type LoginFormState } from "@/app/login/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const initialState: LoginFormState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <Card className="w-full max-w-[420px] rounded-lg shadow-sm">
      <CardHeader className="gap-2 border-b pb-5">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <LockKeyhole className="size-5" />
        </div>
        <div>
          <CardTitle className="text-xl">Acceso administrativo</CardTitle>
          <CardDescription>
            Ingresa para gestionar las operaciones internas de Veeghub.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-1">
        <form action={formAction}>
          <FieldGroup className="gap-4">
            {state.error ? (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}

            <Field>
              <FieldLabel htmlFor="email">Correo corporativo</FieldLabel>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@veeghub.com"
                  className="h-10 pl-8"
                  required
                />
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="password">Contraseña</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                className="h-10"
                required
              />
              <FieldDescription>
                Solo usuarios ADMIN pueden entrar al panel.
              </FieldDescription>
            </Field>

            <Button type="submit" className="h-10 w-full" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Entrar al panel
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
