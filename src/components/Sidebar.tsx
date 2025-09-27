"use client";

import Link from "next/link";
import { Menu, SquarePen, X } from "lucide-react"; // hamburger & close icons
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthenticator } from "@aws-amplify/ui-react";

export default function Sidebar({ page }: { page: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const { signOut } = useAuthenticator((context) => [context.user]);
  const router = useRouter();

  function handleNewChat() {
    router.replace("/chat/");
  }

  return (
    <>
      {/* Top Navbar with Hamburger */}
      <div className="px-6 py-4 flex items-center justify-between lg:absolute lg:top-20 lg:left-0 gap-x-8">
        <button
          onClick={() => setIsOpen(true)}
          className="text-gray-800 dark:text-gray-200 p-2 rounded-md hover:bg-gray-700/80 transition-colors"
          title="Menu"
        >
          <Menu size={32} className="cursor-e-resize" />
        </button>

        <button
          onClick={() => handleNewChat()}
          className="text-gray-800 dark:text-gray-200 p-2 rounded-md hover:bg-gray-700/80 transition-colors"
          title="New Chat"
        >
          <SquarePen size={32} className="cursor-pointer" />
        </button>
      </div>

      {/* Sidebar Overlay */}
      <div
        className={`fixed inset-0 bg-black/30 transition-opacity z-40 ${
          isOpen ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
        onClick={() => setIsOpen(false)}
      />

      {/* Sidebar Drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-800 shadow-lg z-50 transform transition-transform duration-300
          ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Close Button */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Menu
          </h2>
          <button onClick={() => setIsOpen(false)}>
            <X
              size={24}
              className="text-gray-600 dark:text-gray-300 cursor-w-resize"
            />
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex flex-col">
          <Link
            href="/chat"
            className={`${
              page === "chat"
                ? "text-indigo-600 font-bold"
                : "text-gray-700 dark:text-gray-300"
            } hover:text-indigo-500 hover:bg-gray-900 p-4`}
            onClick={() => setIsOpen(false)}
          >
            Chat
          </Link>
          <Link
            href="/documents"
            className={`${
              page === "documents"
                ? "text-indigo-600 font-bold"
                : "text-gray-700 dark:text-gray-300"
            } hover:text-indigo-500 hover:bg-gray-900 p-4`}
            onClick={() => setIsOpen(false)}
          >
            Documents
          </Link>

          {/** This is a button rather than the link cause of signOut.
           * signOut will change the authStatus which in turns rerenders the PreAuth wrapper,
           * when signOut the authStatus becomes unauthenticated. Therefore, automatically bringing the user,
           * back to /logout.
           */}
          <button
            className={`${
              page === "settings"
                ? "text-indigo-600 font-bold"
                : "text-gray-700 dark:text-gray-300"
            } hover:text-indigo-500 hover:bg-gray-900 p-4 flex cursor-pointer`}
            onClick={signOut}
          >
            Sign out
          </button>
        </nav>
      </aside>
    </>
  );
}
