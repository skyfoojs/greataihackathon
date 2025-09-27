"use client";

import Navbar from "@/components/Navbar";
import LoginForm from "@/features/auth/guest-login/components/LoginForm";
import LoginAuth from "@/features/auth/guest-login/components/LoginAuth";

export default function Login() {
  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-gray-900 dark:text-white">
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <LoginAuth>
          <main className="flex-grow flex items-center justify-center px-4 sm:px-6 lg:px-8">
            <div className="w-full max-w-md space-y-8 py-12">
              <div>
                <h2 className="text-center text-3xl font-bold tracking-tight">
                  Log in to your account
                </h2>
              </div>
              <LoginForm />
            </div>
          </main>
        </LoginAuth>
        
      </div>
    </div>
  );
}
