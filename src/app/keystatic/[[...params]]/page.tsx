import { notFound } from "next/navigation";
import { keystaticEnabled } from "@/lib/keystaticEnabled";
import KeystaticPage from "../keystatic";

export default function Page() {
  if (!keystaticEnabled) notFound();
  return <KeystaticPage />;
}
