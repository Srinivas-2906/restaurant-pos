import { redirect } from "next/navigation";

export default function LegacyShiftsRedirect() {
  redirect("/staff/roster");
}
