import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import CreateAdmin from "./pages/CreateAdmin";
import CreateSuperAdmin from "./pages/CreateSuperAdmin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminTeams from "./pages/AdminTeams";
import AdminSwaps from "./pages/AdminSwaps";
import AdminGuards from "./pages/AdminGuards";
import AdminSchedule from "./pages/AdminSchedule";
import AdminExtras from "./pages/AdminExtras";
import AdminSettings from "./pages/AdminSettings";
import SuperAdminPlans from "./pages/SuperAdminPlans";
import SuperAdminManagement from "./pages/SuperAdminManagement";
import GuardDashboard from "./pages/GuardDashboard";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
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
            path="/admin/configuracoes" 
            element={
              <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                <AdminSettings />
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
              <ProtectedRoute allowedRoles={['admin', 'guard']}>
                <Profile />
              </ProtectedRoute>
            } 
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
