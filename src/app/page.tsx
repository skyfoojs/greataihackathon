"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import PreAuth from "@/components/PreAuth";

function RedirectToChat() {
  const router = useRouter();

  useEffect(() => {
    router.push('/chat');
  }, [router]);

  return <></>
}

/** Checks if user is authenticated before redirecting user from / to /chat.
 * If unauthenticated, redirects back to /chat.
 */
export default function Home() {

  return (
    <div className="flex justify-center items-center min-h-screen">
      <PreAuth>
        <RedirectToChat />
      </PreAuth>
    </div>
  );
}