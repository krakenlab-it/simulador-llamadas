import type { Metadata } from "next";
import { SimulatorApp } from "@/app/components/SimulatorApp";
import { APP_ROBOTS } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: "Practicar",
  robots: APP_ROBOTS,
};

export default function SimulatorPage() {
  return <SimulatorApp />;
}
