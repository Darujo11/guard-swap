import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Users, Calendar, Shield, BarChart3, LogOut, ClipboardList, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useSwapNotifications } from '@/hooks/useSwapNotifications';
import { NotificationsBell } from '@/components/notifications/NotificationsBell';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AppLayoutProps {
  children: ReactNode;
  title: string;
  user?: {
    name: string;
    role: 'ADMIN' | 'GUARD';
    teamName?: string;
  };
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard/admin', icon: BarChart3 },
  { name: 'Equipes', href: '/admin/equipes', icon: Users },
  { name: 'Seguranças', href: '/admin/segurancas', icon: Shield },
  { name: 'Trocas', href: '/admin/trocas', icon: Calendar },
  { name: 'Escalas', href: '/admin/escalas', icon: ClipboardList },
];

export function AppLayout({ children, title, user }: AppLayoutProps) {
  const { signOut } = useAuth();
  const { notifications, markAsRead, markAllAsRead } = useSwapNotifications();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/50">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center">
                <Shield className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-xl">ShiftGuard</span>
            </div>
            <div className="hidden md:flex items-center gap-1 ml-6">
              {navigation.map((item) => (
                <Button
                  key={item.name}
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                  asChild
                >
                  <Link to={item.href}>
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Notifications */}
            <NotificationsBell
              notifications={notifications}
              onMarkAsRead={markAsRead}
              onMarkAllAsRead={markAllAsRead}
            />

            {/* User Info */}
            {user && (
              <div className="flex items-center gap-3 pl-3 border-l">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-3">
                      <div className="text-right text-sm hidden md:block">
                        <div className="font-medium">{user.name}</div>
                        <div className="text-muted-foreground flex items-center gap-1">
                          {user.role === 'ADMIN' ? 'Administrador' : 'Segurança'}
                          {user.teamName && (
                            <Badge variant="secondary" className="ml-1">
                              Equipe {user.teamName}
                            </Badge>
                          )}
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
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={signOut} className="cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Sair</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Page Header */}
      <div className="border-b bg-background/50">
        <div className="container py-6 px-4">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        </div>
      </div>

      {/* Main Content */}
      <main className="container py-6 px-4">
        {children}
      </main>
    </div>
  );
}