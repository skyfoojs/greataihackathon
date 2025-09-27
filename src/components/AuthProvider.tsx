'use client';
import { Amplify } from 'aws-amplify';
import outputs from "../../amplify_outputs.json";

Amplify.configure(outputs);

import { Authenticator } from '@aws-amplify/ui-react';
import React from 'react';

export default function AuthProvider({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <Authenticator.Provider>
            {children}
        </Authenticator.Provider>
    );
}
