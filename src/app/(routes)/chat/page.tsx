"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { generateSessionId } from "@/utils/session";
import ChatArea from "@/components/ChatArea";
import ChatHistorySidebar from "@/components/ChatHistorySidebar";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import PreAuth from "@/components/PreAuth";

export default function NewChat() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string>("");

  useEffect(() => {
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
  }, [router]);

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-gray-900 dark:text-white min-h-screen flex flex-col">
      <Navbar />
      <PreAuth>
        <Sidebar page="chat" />
        <ChatHistorySidebar />
        <ChatArea sessionId={sessionId} isNewSession={true} />
      </PreAuth>
    </div>
  );
}
