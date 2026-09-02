import { redirect } from "next/navigation";

export default function MaterialsRedirect() {
  redirect("/inventory/items");
}
