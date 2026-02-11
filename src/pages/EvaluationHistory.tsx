import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { EvaluationList } from "@/components/evaluations/EvaluationList";

const EvaluationHistory = () => {
    const { profile, role } = useAuth();

    // Determine user role for AppLayout
    const userRole = role === 'super_admin' ? 'ADMIN' : (role === 'admin' ? 'ADMIN' : 'GUARD');
    const userRoleForLayout = userRole as 'ADMIN' | 'GUARD';

    return (
        <AppLayout
            title="Histórico de Avaliações"
            user={{
                name: profile?.name || 'Usuário',
                role: userRoleForLayout
            }}
        >
            <div className="space-y-6 animate-in fade-in duration-500">
                <EvaluationList />
            </div>
        </AppLayout>
    );
};

export default EvaluationHistory;
