import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Users, Calendar, Shield, BarChart3, LogOut, ClipboardList, UserCircle, Clock, Crown, DollarSign, Settings, Menu, CalendarOff, FileText, ClipboardCheck } from 'lucide-react';
const logoImage = '/android-chrome-192x192.png';
import { useOrganizationSettings } from '@/hooks/useOrganizationSettings';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useSwapNotifications } from '@/hooks/useSwapNotifications';
import { NotificationsBell } from '@/components/notifications/NotificationsBell';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { APP_VERSION } from '@/lib/version';
interface AppLayoutProps {
  children: ReactNode;
  title: string;
  user?: {
    name: string;
    role: 'ADMIN' | 'GUARD';
    teamName?: string;
  };
}
export function AppLayout({
  children,
  title,
  user
}: AppLayoutProps) {
  const {
    signOut,
    role
  } = useAuth();
  const {
    notifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications
  } = useSwapNotifications();
  const location = useLocation();
  const {
    settings
  } = useOrganizationSettings();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigation = [{
    name: 'Dashboard',
    href: '/dashboard/admin',
    icon: BarChart3,
    roles: ['admin', 'super_admin']
  }, {
    name: settings.guards_label,
    href: '/admin/segurancas',
    icon: Shield,
    roles: ['admin', 'super_admin']
  }, {
    name: settings.swaps_label,
    href: '/admin/trocas',
    icon: Calendar,
    roles: ['admin', 'super_admin']
  }, {
    name: settings.extras_label,
    href: '/admin/extras',
    icon: Clock,
    roles: ['admin', 'super_admin']
  }, {
    name: 'Folgas',
    href: '/admin/folgas',
    icon: CalendarOff,
    roles: ['admin', 'super_admin']
  }, {
    name: 'Fichas',
    href: '/admin/fichas',
    icon: FileText,
    roles: ['admin', 'super_admin']
  }];
  const superAdminNavigation = [{
    name: 'Planos',
    href: '/super-admin/planos',
    icon: DollarSign
  }, {
    name: 'Administradores',
    href: '/super-admin/administradores',
    icon: Crown
  }, {
    name: 'Meu Perfil',
    href: '/perfil',
    icon: Settings
  }];
  const isSuperAdmin = role === 'super_admin';
  return <div className="min-h-screen bg-gradient-to-br from-background to-muted/50">
    {/* Header */}
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          {/* Mobile Menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] sm:w-[340px]">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <img src={logoImage} alt="Escala Smart" className="h-6 w-6" />
                  Escala Smart
                </SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-2">
                {navigation.filter(item => !role || item.roles.includes(role)).map(item => <Button key={item.name} variant={location.pathname === item.href ? "secondary" : "ghost"} className="justify-start gap-3" asChild onClick={() => setMobileMenuOpen(false)}>
                  <Link to={item.href}>
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                </Button>)}

                {isSuperAdmin && <>
                  <div className="my-2 border-t" />
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                    Super Admin
                  </div>
                  {superAdminNavigation.map(item => <Button key={item.name} variant={location.pathname === item.href ? "secondary" : "ghost"} className="justify-start gap-3 text-amber-600 dark:text-amber-400" asChild onClick={() => setMobileMenuOpen(false)}>
                    <Link to={item.href}>
                      <item.icon className="h-5 w-5" />
                      {item.name}
                    </Link>
                  </Button>)}
                </>}

                <div className="my-2 border-t" />
                <Button variant="ghost" className="justify-start gap-3 text-destructive hover:text-destructive" onClick={() => {
                  setMobileMenuOpen(false);
                  signOut();
                }}>
                  <LogOut className="h-5 w-5" />
                  Sair
                </Button>
              </nav>
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2">
            <img src={logoImage} alt="Escala Smart" className="h-8 w-8" />
            <span className="font-semibold text-xl hidden sm:inline">Seguranças Unidos</span>
          </div>
          <div className="hidden md:flex items-center gap-1 ml-6">
            {navigation.filter(item => !role || item.roles.includes(role)).map(item => <Button key={item.name} variant="ghost" size="sm" className="gap-2" asChild>
              <Link to={item.href}>
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            </Button>)}

            {/* Super Admin Menu */}
            {isSuperAdmin && <>
              <div className="h-6 w-px bg-border mx-2" />
              {superAdminNavigation.map(item => <Button key={item.name} variant="ghost" size="sm" className="gap-2 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300" asChild>
                <Link to={item.href}>
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              </Button>)}
            </>}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Notifications */}
          <NotificationsBell notifications={notifications} onMarkAsRead={markAsRead} onMarkAllAsRead={markAllAsRead} onDelete={deleteNotification} onClearAll={clearAllNotifications} />

          {/* User Info */}
          {user && <div className="flex items-center gap-3 pl-3 border-l">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-3">
                  <div className="text-right text-sm hidden md:block">
                    <div className="font-medium">{user.name}</div>
                    <div className="text-muted-foreground">
                      {user.role === 'ADMIN' ? 'Administrador' : 'Segurança'}
                    </div>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/perfil" className="cursor-pointer">
                    <UserCircle className="mr-2 h-4 w-4" />
                    <span>Perfil</span>
                  </Link>
                </DropdownMenuItem>
                <div className="px-2 py-1.5 text-xs text-muted-foreground text-center">
                  Versão {APP_VERSION}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => signOut()} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>}
        </div>
      </div>
    </header>

    {/* Page Header */}
    <div className="border-b bg-background/50">
      <div className="container py-6 px-4">
        <h1 className="text-3xl font-bold tracking-tight text-center">{title}</h1>
      </div>
    </div>

    {/* Main Content */}
    <main className="container py-6 px-4">
      {children}
    </main>
  </div>;
}