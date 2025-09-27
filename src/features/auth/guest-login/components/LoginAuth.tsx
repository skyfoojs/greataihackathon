
import React, { useEffect } from "react";
import { useRouter } from 'next/navigation';
import { useAuthenticator } from '@aws-amplify/ui-react';

export default function LoginAuth({
  children
}: {
  children: React.ReactNode 
}) {
  const router = useRouter();
  const { authStatus } = useAuthenticator((context) => [context.authStatus]);

  useEffect(() => {
    if (authStatus === "authenticated") {
      router.push('/chat');
    }
  }, [authStatus, router]);

  if (authStatus !== "unauthenticated") {
    return null;
  }

  return (
    <>{children}</>
  );
}
