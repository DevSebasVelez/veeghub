import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/35 px-5 py-10">
      <Card className="w-full max-w-[520px] rounded-lg shadow-sm">
        <CardHeader>
          <CardTitle>Panel administrativo</CardTitle>
          <CardDescription>
            Sesión iniciada como {session.user.email ?? session.user.name}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async () => {
              "use server";

              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button type="submit" variant="outline">
              Cerrar sesión
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
