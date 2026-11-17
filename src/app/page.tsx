import { redirect } from "next/navigation";
import { DEFAULT_MODE } from "@/lib/modes";

export default function Home() {
  redirect(`/${DEFAULT_MODE.id}`);
}
