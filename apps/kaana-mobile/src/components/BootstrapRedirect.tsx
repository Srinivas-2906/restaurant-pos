import { useEffect } from "react";

import { usePathname, useRootNavigationState, useRouter } from "expo-router";

import { shellPathForDeviceType } from "../session/bootstrap";

import { useSession } from "../session/SessionProvider";



function resolveBootstrapHref(

  revokedMessage: string | null,

  bootstrapTarget: ReturnType<typeof useSession>["bootstrapTarget"],

  terminal: ReturnType<typeof useSession>["terminal"],

): string {

  if (revokedMessage) return "/entry";



  switch (bootstrapTarget.kind) {

    case "management":

      return "/management";

    case "operational-login":

      return "/operational/login";

    case "operational-shell":

      return shellPathForDeviceType(bootstrapTarget.deviceType);

    case "entry":

    default:

      return terminal ? "/operational/login" : "/entry";

  }

}



/** True when user opened a deliberate sub-flow from entry (owner login, activation). */

function isEntrySubFlow(pathname: string) {

  return pathname.startsWith("/auth") || pathname.startsWith("/activate");

}



export function BootstrapRedirect() {

  const router = useRouter();

  const pathname = usePathname();

  const rootNavigationState = useRootNavigationState();

  const { bootstrapping, bootstrapError, bootstrapTarget, revokedMessage, terminal } = useSession();



  useEffect(() => {

    if (bootstrapping || bootstrapError || !rootNavigationState?.key) return;



    const href = resolveBootstrapHref(revokedMessage, bootstrapTarget, terminal);



    // Do not yank the user out of owner login / device activation once they chose it.

    if (bootstrapTarget.kind === "entry" && isEntrySubFlow(pathname)) return;



    if (pathname === href || pathname.startsWith(`${href}/`)) return;



    router.replace(href);

  }, [

    bootstrapping,

    bootstrapError,

    bootstrapTarget,

    pathname,

    revokedMessage,

    rootNavigationState?.key,

    router,

    terminal,

  ]);



  return null;

}

