"use client";
import React from "react";
import { AuthProvider } from "@/context/AuthContext";
import SearchModal from "@/components/SearchModal";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <SearchModal />
    </AuthProvider>
  );
}
