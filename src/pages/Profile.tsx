import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export default function Profile() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  
  // Profile data
  const [name, setName] = useState("");
  const [role, setRole] = useState("");

  useEffect(() => {
    if (authLoading) return; // espere auth carregar
    if (!user) {
      navigate("/login");
      return;
    }
    fetchProfile();
  }, [authLoading, user, navigate]);

  const fetchProfile = async () => {
    if (!user) return;
    
    setProfileLoading(true);
    
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          *,
          team:teams(name)
        `)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setName(data.name || "");
        
        // Determine role based on shift chief status and team
        let roleText = "Segurança";
        if (data.is_shift_chief) {
          roleText = "Chefe de Plantão";
        }
        if (data.team) {
          roleText += ` - ${data.team.name}`;
        }
        setRole(roleText);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar perfil",
        description: error.message,
      });
    } finally {
      setProfileLoading(false);
    }
  };


  if (profileLoading) {
    return (
      <AppLayout title="Meu Perfil">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Meu Perfil">
      <div className="container mx-auto p-3 md:p-6 max-w-4xl">
        <div className="mb-4 md:mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Meu Perfil</h1>
          <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">
            Gerencie suas informações pessoais e segurança
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Informações do Perfil</CardTitle>
            <CardDescription>
              Suas informações como segurança
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={name}
                readOnly
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Cargo</Label>
              <Input
                id="role"
                value={role}
                readOnly
                disabled
                className="bg-muted"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
