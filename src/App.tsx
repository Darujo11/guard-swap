import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";
import { VersionChecker } from "@/components/VersionChecker";
import Index from "./pages/Index";
import Login from "./pages/Login";
import TrialSignup from "./pages/TrialSignup";
import CreateAdmin from "./pages/CreateAdmin";
import CreateSuperAdmin from "./pages/CreateSuperAdmin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminTeams from "./pages/AdminTeams";
import AdminSwaps from "./pages/AdminSwaps";
import AdminGuards from "./pages/AdminGuards";
import AdminSchedule from "./pages/AdminSchedule";
import AdminExtras from "./pages/AdminExtras";
import AdminLeaves from "./pages/AdminLeaves";
import SuperAdminPlans from "./pages/SuperAdminPlans";
import SuperAdminManagement from "./pages/SuperAdminManagement";
import SuperAdminResetPassword from "./pages/SuperAdminResetPassword";
import GuardDashboard from "./pages/GuardDashboard";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <VersionChecker />
      <Toaster />
      <Sonner />
      <HashRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/home" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/teste-gratuito" element={<TrialSignup />} />
          <Route path="/criar-admin" element={<CreateAdmin />} />
          <Route path="/criar-super-admin" element={<CreateSuperAdmin />} />
          <Route 
            path="/dashboard/admin" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/equipes" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminTeams />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/trocas" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminSwaps />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/segurancas" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminGuards />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/escalas" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminSchedule />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/extras" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminExtras />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/folgas" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLeaves />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/super-admin/planos" 
            element={
              <ProtectedRoute allowedRoles={['super_admin']}>
                <SuperAdminPlans />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/super-admin/administradores" 
            element={
              <ProtectedRoute allowedRoles={['super_admin']}>
                <SuperAdminManagement />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/super-admin/resetar-senha" 
            element={
              <ProtectedRoute allowedRoles={['super_admin']}>
                <SuperAdminResetPassword />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/dashboard/guard" 
            element={
              <ProtectedRoute allowedRoles={['guard']}>
                <GuardDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/perfil" 
            element={
              <ProtectedRoute allowedRoles={['admin', 'guard', 'super_admin']}>
                <Profile />
              </ProtectedRoute>
            } 
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
