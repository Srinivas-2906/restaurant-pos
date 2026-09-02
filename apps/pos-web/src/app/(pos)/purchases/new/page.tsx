import { redirect } from "next/navigation";

export default function NewPORedirect() {
  redirect("/purchases/orders");
}
