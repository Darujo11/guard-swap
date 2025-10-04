import { useState } from 'react';
import logoImage from '@/assets/logo.png';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, Users, Calendar, BarChart3, ArrowRight, Clock, CheckCircle, Zap, Star, TrendingUp, Bell, FileText, Lock } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';

const Index = () => {
  const [selectedRole, setSelectedRole] = useState<'ADMIN' | 'GUARD' | null>(null);
  
  // Scroll animations
  const heroAnimation = useScrollAnimation();
  const useCasesAnimation = useScrollAnimation();
  const benefitsAnimation = useScrollAnimation();
  const featuresAnimation = useScrollAnimation();
  const pricingAnimation = useScrollAnimation();
  const testimonialsAnimation = useScrollAnimation();

  const features = [
    {
      icon: Users,
      title: 'Gestão de Equipes',
      description: 'Organize e gerencie múltiplas equipes com total controle e visibilidade',
    },
    {
      icon: Calendar,
      title: 'Escala Inteligente',
      description: 'Crie e visualize escalas automaticamente com calendário visual intuitivo',
    },
    {
      icon: ArrowRight,
      title: 'Trocas de Plantão',
      description: 'Sistema completo para solicitar, aprovar e gerenciar trocas entre membros',
    },
    {
      icon: Bell,
      title: 'Notificações em Tempo Real',
      description: 'Receba alertas instantâneos sobre trocas, escalas e atualizações importantes',
    },
    {
      icon: BarChart3,
      title: 'Dashboard Analítico',
      description: 'Métricas e relatórios detalhados para otimizar a gestão operacional',
    },
    {
      icon: Clock,
      title: 'Controle de Extras',
      description: 'Gerencie e registre plantões extras com total rastreabilidade',
    },
    {
      icon: FileText,
      title: 'Relatórios Completos',
      description: 'Gere relatórios detalhados de escalas, trocas e desempenho de equipes',
    },
    {
      icon: Lock,
      title: 'Segurança de Dados',
      description: 'Sistema com autenticação robusta e proteção total dos dados',
    },
  ];

  const benefits = [
    {
      icon: Zap,
      title: 'Eficiência Aumentada',
      description: 'Reduza em até 70% o tempo gasto com gestão de escalas e plantões',
    },
    {
      icon: TrendingUp,
      title: 'Otimização de Recursos',
      description: 'Maximize a utilização de sua equipe com planejamento inteligente',
    },
    {
      icon: CheckCircle,
      title: 'Zero Conflitos',
      description: 'Elimine conflitos e erros na programação de escalas e plantões',
    },
  ];

  const useCases = [
    {
      icon: Shield,
      title: 'Segurança',
      description: 'Gerencie equipes de vigilância, portaria e segurança patrimonial',
      color: 'from-blue-500 to-blue-600',
    },
    {
      icon: Users,
      title: 'Saúde',
      description: 'Organize escalas de médicos, enfermeiros e equipes hospitalares',
      color: 'from-green-500 to-green-600',
    },
    {
      icon: Clock,
      title: 'Indústria',
      description: 'Controle turnos de produção e operação em fábricas e plantas',
      color: 'from-orange-500 to-orange-600',
    },
    {
      icon: BarChart3,
      title: 'Varejo',
      description: 'Escale atendentes, caixas e equipes de vendas com eficiência',
      color: 'from-purple-500 to-purple-600',
    },
  ];

  const plans = [
    {
      name: 'Básico',
      price: 'R$ 199',
      period: '/mês',
      description: 'Ideal para pequenas equipes',
      features: [
        'Até 20 seguranças',
        '4 equipes simultâneas',
        'Sistema de trocas',
        'Dashboard básico',
        'Suporte por email',
      ],
      highlighted: false,
    },
    {
      name: 'Profissional',
      price: 'R$ 399',
      period: '/mês',
      description: 'Para operações de médio porte',
      features: [
        'Até 50 seguranças',
        'Equipes ilimitadas',
        'Sistema de trocas avançado',
        'Dashboard completo',
        'Relatórios detalhados',
        'Suporte prioritário',
        'Notificações push',
      ],
      highlighted: true,
    },
    {
      name: 'Enterprise',
      price: 'Personalizado',
      period: '',
      description: 'Solução completa para grandes empresas',
      features: [
        'Seguranças ilimitados',
        'Equipes ilimitadas',
        'API personalizada',
        'Integrações customizadas',
        'Suporte 24/7',
        'Treinamento dedicado',
        'SLA garantido',
      ],
      highlighted: false,
    },
  ];

  const testimonials = [
    {
      name: 'Dr. Carlos Silva',
      role: 'Diretor Médico',
      company: 'Hospital São Lucas',
      content: 'Revolucionou nossa gestão de plantões médicos. Organizamos 50+ profissionais com facilidade e zero conflitos.',
      rating: 5,
    },
    {
      name: 'Marina Santos',
      role: 'Coordenadora de Segurança',
      company: 'GuardPro',
      content: 'Sistema intuitivo e completo. A equipe adotou rapidamente e já vimos redução significativa em custos operacionais.',
      rating: 5,
    },
    {
      name: 'Roberto Oliveira',
      role: 'Gerente de Operações',
      company: 'Indústria TechMax',
      content: 'Perfeito para gestão de turnos de produção. Os relatórios nos ajudam a otimizar recursos e aumentar produtividade.',
      rating: 5,
    },
  ];

  if (selectedRole) {
    window.location.href = '/login';
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={logoImage} alt="Escala Smart" className="h-10 w-10" />
              <span className="text-2xl font-bold">Escala Smart</span>
            </div>
            <Button onClick={() => setSelectedRole('ADMIN')}>
              Entrar
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="container mx-auto px-4 py-20 sm:py-32">
          <div 
            ref={heroAnimation.ref}
            className={`text-center max-w-5xl mx-auto transition-all duration-700 ${
              heroAnimation.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
            }`}
          >
            <Badge className="mb-6 text-sm py-2 px-4" variant="secondary">
              <Zap className="h-4 w-4 mr-2" />
              A Solução Completa para Gestão de Escalas
            </Badge>
            
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              Gestão de Escalas e Plantões{' '}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Simplificada
              </span>
            </h1>
            
            <p className="text-xl sm:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto">
              Para hospitais, empresas de segurança, indústrias e qualquer operação que precisa 
              gerenciar equipes em turnos de forma inteligente e eficiente
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Button 
                size="lg" 
                className="gap-2 text-lg px-8 py-6"
                onClick={() => setSelectedRole('ADMIN')}
              >
                Começar Agora
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="gap-2 text-lg px-8 py-6"
                onClick={() => {
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Conhecer Recursos
              </Button>
            </div>

            {/* Social Proof */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-8 text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/60 border-2 border-background" />
                  ))}
                </div>
                <span className="text-sm font-medium">+500 empresas confiam</span>
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="h-5 w-5 fill-primary text-primary" />
                ))}
                <span className="text-sm font-medium ml-2">4.9/5 avaliação</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Use Cases Section */}
      <div className="py-20 bg-gradient-to-br from-muted/50 via-background to-muted/30">
        <div className="container mx-auto px-4">
          <div 
            ref={useCasesAnimation.ref}
            className={`text-center mb-16 transition-all duration-700 ${
              useCasesAnimation.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
            }`}
          >
            <Badge className="mb-4" variant="outline">Setores Atendidos</Badge>
            <h2 className="text-3xl sm:text-5xl font-bold mb-4">
              Solução Versátil para Diversos Setores
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Do setor de saúde à segurança, da indústria ao varejo - uma plataforma, infinitas possibilidades
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {useCases.map((useCase, index) => (
              <Card 
                key={index} 
                className={`border-0 bg-background shadow-lg hover:shadow-xl transition-all duration-500 group ${
                  useCasesAnimation.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <CardHeader>
                  <div className={`h-14 w-14 rounded-xl bg-gradient-to-br ${useCase.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <useCase.icon className="h-7 w-7 text-white" />
                  </div>
                  <CardTitle className="text-xl">{useCase.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{useCase.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div 
            ref={benefitsAnimation.ref}
            className={`text-center mb-16 transition-all duration-700 ${
              benefitsAnimation.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
            }`}
          >
            <Badge className="mb-4" variant="outline">Por que escolher</Badge>
            <h2 className="text-3xl sm:text-5xl font-bold mb-4">
              Benefícios que Transformam sua Operação
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Economize tempo, reduza custos e aumente a satisfação da sua equipe
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {benefits.map((benefit, index) => (
              <Card 
                key={index} 
                className={`border-0 bg-background shadow-lg hover:shadow-xl transition-all duration-500 ${
                  benefitsAnimation.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <CardHeader>
                  <div className="h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <benefit.icon className="h-7 w-7 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">{benefit.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-lg">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="container mx-auto px-4 py-20">
        <div 
          ref={featuresAnimation.ref}
          className={`text-center mb-16 transition-all duration-700 ${
            featuresAnimation.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
        >
          <Badge className="mb-4" variant="outline">Recursos</Badge>
          <h2 className="text-3xl sm:text-5xl font-bold mb-4">
            Tudo que Você Precisa em Um Só Lugar
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Ferramentas poderosas para gerenciar equipes de segurança com eficiência
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className={`group hover:shadow-lg hover:scale-105 transition-all duration-500 border-0 bg-background ${
                featuresAnimation.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
              }`}
              style={{ transitionDelay: `${index * 50}ms` }}
            >
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  <feature.icon className="h-6 w-6" />
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Pricing Section */}
      <div className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div 
            ref={pricingAnimation.ref}
            className={`text-center mb-16 transition-all duration-700 ${
              pricingAnimation.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
            }`}
          >
            <Badge className="mb-4" variant="outline">Planos</Badge>
            <h2 className="text-3xl sm:text-5xl font-bold mb-4">
              Escolha o Plano Ideal para Você
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Transparência total, sem taxas escondidas
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan, index) => (
              <Card 
                key={index} 
                className={`relative group hover:-translate-y-2 transition-all duration-500 cursor-pointer ${
                  plan.highlighted 
                    ? 'border-primary border-2 shadow-2xl scale-105 hover:scale-110 hover:shadow-primary/20' 
                    : 'border-0 hover:shadow-2xl hover:border-primary/50 hover:border'
                } ${
                  pricingAnimation.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{ transitionDelay: `${index * 150}ms` }}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-4 py-1">
                      Mais Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-8">
                  <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
                  <CardDescription className="mb-4">{plan.description}</CardDescription>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, fIndex) => (
                      <li key={fIndex} className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className="w-full" 
                    size="lg"
                    variant={plan.highlighted ? 'default' : 'outline'}
                    onClick={() => setSelectedRole('ADMIN')}
                  >
                    {plan.price === 'Personalizado' ? 'Falar com Vendas' : 'Começar Agora'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Testimonials Section */}
      <div className="py-20">
        <div className="container mx-auto px-4">
          <div 
            ref={testimonialsAnimation.ref}
            className={`text-center mb-16 transition-all duration-700 ${
              testimonialsAnimation.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
            }`}
          >
            <Badge className="mb-4" variant="outline">Depoimentos</Badge>
            <h2 className="text-3xl sm:text-5xl font-bold mb-4">
              O Que Nossos Clientes Dizem
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <Card 
                key={index} 
                className={`border-0 bg-background shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-500 ${
                  testimonialsAnimation.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <CardHeader>
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-primary text-primary" />
                    ))}
                  </div>
                  <CardDescription className="text-base text-foreground">
                    "{testimonial.content}"
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="font-semibold">{testimonial.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {testimonial.role} • {testimonial.company}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary-hover" />
        <div className="absolute inset-0 bg-grid-pattern opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/20 via-transparent to-transparent" />
        
        <div className="container mx-auto px-4 py-24 text-center relative">
          <div className="max-w-4xl mx-auto">
            <Badge className="mb-6 bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20">
              <Zap className="h-4 w-4 mr-2" />
              Comece Hoje Mesmo
            </Badge>
            
            <h2 className="text-4xl sm:text-6xl font-bold text-primary-foreground mb-6 leading-tight">
              Pronto para Transformar
              <br />
              sua Gestão?
            </h2>
            
            <p className="text-xl sm:text-2xl text-primary-foreground/90 mb-12 max-w-2xl mx-auto leading-relaxed">
              Junte-se a centenas de empresas que já otimizaram suas operações 
              com o Escala Smart
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Button 
                size="lg" 
                variant="secondary"
                className="gap-2 text-lg px-8 py-7 shadow-2xl hover:shadow-xl hover:scale-105 transition-all"
                onClick={() => setSelectedRole('ADMIN')}
              >
                Começar Gratuitamente
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="gap-2 text-lg px-8 py-7 border-2 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground hover:text-primary hover:scale-105 transition-all backdrop-blur-sm bg-primary-foreground/5"
                onClick={() => setSelectedRole('GUARD')}
              >
                Ver Demonstração
                <Shield className="h-5 w-5" />
              </Button>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-6 text-primary-foreground/80 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                <span>Sem cartão de crédito</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                <span>Cancele quando quiser</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                <span>Suporte em português</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t bg-background">
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <img src={logoImage} alt="Escala Smart" className="h-8 w-8" />
                <span className="text-xl font-bold">Escala Smart</span>
              </div>
              <p className="text-muted-foreground mb-4 max-w-sm">
                A solução completa para gestão inteligente de escalas e plantões em qualquer setor.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Produto</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Recursos</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Preços</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Atualizações</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Empresa</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Sobre</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contato</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Suporte</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <p>© 2025 Escala Smart. Todos os direitos reservados.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-foreground transition-colors">Privacidade</a>
              <a href="#" className="hover:text-foreground transition-colors">Termos</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
