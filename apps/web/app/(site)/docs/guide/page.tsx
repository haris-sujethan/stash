import { redirect } from "next/navigation";

// The guide moved: the short docs are at /docs, the developer guide at /docs/dev.
export default function OldGuide() {
  redirect("/docs");
}
