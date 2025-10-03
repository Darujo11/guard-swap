// ShiftGuard - Sistema de Gestão de Plantões

import { useState } from 'react';
import heroImage from '@/assets/hero-dashboard.jpg';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, Users, Calendar, BarChart3, ArrowRight, Clock, CheckCircle } from 'lucide-react';

const Index = () => {
  const [selectedRole, setSelectedRole] = useState<'ADMIN' | 'GUARD' | null>(null);

  const features = [
    {
      icon: Users,
      title: 'Gestão de Equipes',
      description: 'Organize seguranças em 4 equipes (A, B, C, D) com controle completo',
    },
    {
      icon: Calendar,
      title: 'Escala de Plantões',
      description: 'Programe turnos diurnos e noturnos com alocação por localização',
    },
    {
      icon: ArrowRight,
      title: 'Trocas de Plantão',
      description: 'Sistema completo para solicitar e aprovar trocas entre equipes',
    },
    {
      icon: BarChart3,
      title: 'Dashboard Analítico',
      description: 'Métricas e relatórios para otimizar a gestão operacional',
    },
  ];

  const stats = [
    { label: 'Equipes Ativas', value: '4', icon: Users, color: 'text-primary' },
    { label: 'Seguranças', value: '20', icon: Shield, color: 'text-success' },
    { label: 'Trocas Aprovadas', value: '24', icon: CheckCircle, color: 'text-warning' },
    { label: 'Uptime', value: '99.9%', icon: Clock, color: 'text-danger' },
  ];

  if (selectedRole) {
    window.location.href = '/login';
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container mx-auto px-4 py-16 sm:py-24">
          <div className="text-center max-w-4xl mx-auto">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center shadow-lg">
                <Shield className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="text-4xl sm:text-6xl font-bold bg-gradient-to-r from-primary to-primary-hover bg-clip-text text-transparent">
                ShiftGuard
              </h1>
            </div>
            
            <p className="text-xl sm:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Sistema profissional para gestão de equipes de segurança e controle de plantões
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button 
                size="lg" 
                className="gap-2 bg-gradient-to-r from-primary to-primary-hover shadow-lg hover:shadow-xl transition-all"
                onClick={() => setSelectedRole('ADMIN')}
              >
                <BarChart3 className="h-5 w-5" />
                Acesso Administrativo
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="gap-2 hover:bg-primary hover:text-primary-foreground transition-all"
                onClick={() => setSelectedRole('GUARD')}
              >
                <Shield className="h-5 w-5" />
                Acesso Segurança
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-16">
              {stats.map((stat, index) => (
                <Card key={index} className="border-0 bg-background/60 backdrop-blur-sm">
                  <CardContent className="p-6 text-center">
                    <stat.icon className={`h-6 w-6 mx-auto mb-2 ${stat.color}`} />
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Recursos Principais
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Tudo que você precisa para gerenciar equipes de segurança com eficiência e profissionalismo
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="group hover:shadow-lg transition-all duration-300 border-0 bg-background/80 backdrop-blur-sm">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-primary to-primary-hover">
        <div className="container mx-auto px-4 py-16 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary-foreground mb-4">
            Pronto para começar?
          </h2>
          <p className="text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
            Modernize a gestão da sua equipe de segurança com nosso sistema completo
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              variant="secondary"
              className="gap-2"
              onClick={() => setSelectedRole('ADMIN')}
            >
              Dashboard Administrativo
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="gap-2 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground hover:text-primary"
              onClick={() => setSelectedRole('GUARD')}
            >
              Painel do Segurança
              <Shield className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-8 text-center text-muted-foreground">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Shield className="h-4 w-4" />
            <span className="font-semibold">ShiftGuard</span>
          </div>
          <p className="text-sm">Sistema de Gestão de Plantões - Versão 1.0</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
