import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clínica de Citas · Simulador de llamada",
  description:
    "Formación comercial: practica llamadas en frío con clientes simulados (voz o texto).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
