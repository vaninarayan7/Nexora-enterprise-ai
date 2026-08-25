import React, { useState } from "react";
import { motion } from "motion/react";
import { ShieldAlert, Building2, Users, User, ArrowRight } from "lucide-react";
import { setSelectedRole } from "../lib/firebaseAuth";
import { useNavigate } from "react-router-dom";
import { UserRole } from "../types";

import { auth } from "../lib/firebase";
import { getUserProfile, saveUserProfile } from "../lib/firebaseDb";
import { getDashboardRouteForRole } from "../lib/roleHelper";

export default function WelcomeScreen({ onRoleSelected }: { onRoleSelected?: (role: UserRole) => void }) {
  const navigate = useNavigate();
  const [hoveredRole, setHoveredRole] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSelectRole = async (e: React.MouseEvent, role: UserRole) => {
    e.preventDefault();
    
    console.group("[WelcomeScreen DEBUG] Role Selection");
    console.log("3. Selected role:", role);
    
    if (!auth.currentUser) {
      console.log(`No session exists. Storing pending role ${role} and navigating to target: /landing`);
      sessionStorage.setItem("pending_role", role);
      console.groupEnd();
      navigate("/landing");
      return;
    }
    
    console.log("3. User ID:", auth.currentUser.uid);
    setIsProcessing(true);

    try {
      let profile = await getUserProfile(auth.currentUser.uid);
      if (!profile) {
        profile = {
          uid: auth.currentUser.uid,
          email: auth.currentUser.email || "",
          displayName: auth.currentUser.displayName || "User",
        } as any;
      }
      
      // Do NOT overwrite role if they already have an active organization membership
      // unless they are explicitly choosing "Organizer" to create a new one.
      if (!profile.organizationId || role === "Organizer") {
        profile.role = role;
      } else {
        console.log(`[WelcomeScreen] User already has an active membership (${profile.role}). Skipping role overwrite to ${role}.`);
      }
      profile.onboardingCompleted = true;
      
      console.log("4. Saving role to Firestore...");
      await saveUserProfile(profile as any);
      
      console.log("5. Role assignment successful.");
      if (onRoleSelected) {
        onRoleSelected(role);
      }
    } catch (err) {
      console.error("Failed to save role:", err);
      setIsProcessing(false);
    } finally {
      console.groupEnd();
    }
  };

  const roles: {
    id: UserRole;
    title: string;
    description: string;
    icon: any;
    color: string;
    bg: string;
    border: string;
  }[] = [
    {
      id: "Super Admin",
      title: "Super Admin",
      description: "Manage platform analytics, organizations, subscriptions, and platform-wide configurations.",
      icon: ShieldAlert,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
    },
    {
      id: "Organizer",
      title: "Organizer (Owner)",
      description: "Own an organization, invite managers and employees, view organization analytics.",
      icon: Building2,
      color: "text-indigo-500",
      bg: "bg-indigo-500/10",
      border: "border-indigo-500/20",
    },
    {
      id: "Manager",
      title: "Manager",
      description: "Join an existing organization as a Manager using an invitation code.",
      icon: Users,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    {
      id: "Employee",
      title: "Employee",
      description: "Join an existing organization as an Employee using an invitation code.",
      icon: User,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    },

  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0C10] text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-2xl mx-auto mb-10"
      >
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight">
          Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-400">Enterprise AI</span>
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-lg">
          Select your enterprise role to set up your workspace environment.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto w-full">
        {roles.map((role, idx) => (
          <motion.div
            key={role.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            onMouseEnter={() => setHoveredRole(role.id)}
            onMouseLeave={() => setHoveredRole(null)}
            onClick={(e) => {
              if (!isProcessing) handleSelectRole(e, role.id);
            }}
            className={`relative p-6 rounded-2xl border ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} transition-all duration-300 backdrop-blur-xl flex flex-col justify-between ${
              hoveredRole === role.id
                ? `scale-105 shadow-2xl ${role.border} bg-white/60 dark:bg-slate-900/60`
                : "border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700"
            }`}
          >
            <div>
              <div className={`w-14 h-14 rounded-xl ${role.bg} ${role.color} flex items-center justify-center mb-6`}>
                <role.icon className="w-7 h-7" />
              </div>
              
              <h3 className="text-xl font-bold mb-2">{role.title}</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
                {role.description}
              </p>
            </div>

            <div className={`flex items-center gap-2 text-sm font-semibold ${hoveredRole === role.id ? role.color : "text-slate-400 dark:text-slate-500"}`}>
              <span>Select Role</span>
              <ArrowRight className={`w-4 h-4 transition-transform ${hoveredRole === role.id ? "translate-x-1" : ""}`} />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
