import { ReactNode } from 'react';
import { Bell, Users, Calendar, Shield, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
  title: string;
  user?: {
    name: string;
    role: 'ADMIN' | 'GUARD';
    teamName?: string;
  };
  notificationCount?: number;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
  { name: 'Equipes', href: '/teams', icon: Users },
  { name: 'Plantões', href: '/shifts', icon: Calendar },
  { name: 'Seguranças', href: '/guards', icon: Shield },
];

export function AppLayout({ children, title, user, notificationCount = 0 }: AppLayoutProps) {
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
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Notifications */}
            <Button variant="ghost" size="sm" className="relative">
              <Bell className="h-4 w-4" />
              {notificationCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
                >
                  {notificationCount > 9 ? '9+' : notificationCount}
                </Badge>
              )}
            </Button>

            {/* User Info */}
            {user && (
              <div className="flex items-center gap-3 pl-3 border-l">
                <div className="text-right text-sm">
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