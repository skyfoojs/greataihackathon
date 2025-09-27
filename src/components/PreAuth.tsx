'use client';

import { useAuthenticator } from '@aws-amplify/ui-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';


export default function PreAuth({
  children,
}: {
  children: React.ReactNode
}) {
  const { authStatus } = useAuthenticator(context => [context.authStatus]);
  const router = useRouter();


  return <>{children}</>;
}