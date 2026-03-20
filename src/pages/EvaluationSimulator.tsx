import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from '@/components/layout/AppLayout';
import { criteria, SCORE_LABELS } from "@/data/criteria";
import CriterionCard from "@/components/evaluations/CriterionCard";
import ScoreSummary from "@/components/evaluations/ScoreSummary";
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";
import { Profile } from "@/lib/types";
import { GuardCombobox } from "@/components/evaluations/GuardCombobox";
import { Button } from "@/components/ui/button";
import { Save, Loader2, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { generateEvaluationPDF } from "@/utils/pdfGenerator";
import { EvaluationList } from "@/components/evaluations/EvaluationList";

const EvaluationSimulator = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { profile, role } = useAuth();
    const { toast } = useToast();
    const [scores, setScores] = useState<Record<number, number>>(() => {
        const initialScores: Record<number, number> = {};
        if (criteria && criteria.length > 0) {
            criteria.forEach(c => {
                initialScores[c.id] = 10;
            });
        }
        return initialScores;
    });
    const [guards, setGuards] = useState<Profile[]>([]);
    const [selectedGuardId, setSelectedGuardId] = useState<string>("");
    const [loadingGuards, setLoadingGuards] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadingEvaluation, setLoadingEvaluation] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        fetchGuards();
    }, [profile?.id]);

    useEffect(() => {
        if (selectedGuardId && !id) {
            checkExistingEvaluation(selectedGuardId);
        }
    }, [selectedGuardId]);

    const checkExistingEvaluation = async (guardId: string) => {
        // Define start and end of current month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

        try {
            // @ts-ignore
            const { data, error } = await supabase
                .from('evaluations')
                .select('id')
                .eq('guard_id', guardId)
                .gte('created_at', startOfMonth)
                .lte('created_at', endOfMonth)
                .limit(1)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                toast({
                    title: "Avaliação Existente",
                    description: "Já existe uma avaliação para este mês. Carregando...",
                });
                navigate(`/simulador-avaliacao/${data.id}`);
            }
        } catch (error) {
            console.error('Error checking existing evaluation:', error);
        }
    };

    useEffect(() => {
        if (id) {
            fetchEvaluation(id);
        } else {
            // Force initialization if empty (double check)
            if (Object.keys(scores).length === 0 && criteria.length > 0) {
                const initialScores: Record<number, number> = {};
                criteria.forEach(c => {
                    initialScores[c.id] = 10;
                });
                setScores(initialScores);
            }
        }
    }, [id]);

    const fetchEvaluation = async (evaluationId: string) => {
        setLoadingEvaluation(true);
        try {
            const { data, error } = await (supabase as any)
                .from('evaluations')
                .select(`*, guard:profiles!evaluations_guard_id_fkey(*), evaluator:profiles!evaluations_evaluator_id_fkey(*)`)
                .eq('id', evaluationId)
                .single();

            if (error) throw error;
            if (data) {
                setSelectedGuardId(data.guard_id);
                const loadedScores: Record<number, number> = {};
                Object.entries(data.scores).forEach(([k, v]: [string, any]) => {
                    loadedScores[Number(k)] = Number(v);
                });
                setScores(loadedScores);
            }
        } catch (error) {
            console.error('Error fetching evaluation:', error);
            toast({
                title: "Erro ao carregar avaliação",
                description: "Não foi possível carregar os dados da avaliação.",
                variant: "destructive",
            });
            navigate('/simulador-avaliacao');
        } finally {
            setLoadingEvaluation(false);
        }
    };

    const fetchGuards = async () => {
        if (!profile?.id) return;
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('admin_id', profile.id)
                .order('name');

            if (error) throw error;
            setGuards((data || []) as Profile[]);
        } catch (error) {
            console.error('Error fetching guards:', error);
            toast({
                title: "Erro ao carregar seguranças",
                description: "Não foi possível carregar a lista de seguranças.",
                variant: "destructive",
            });
        } finally {
            setLoadingGuards(false);
        }
    };

    const handleSelect = (criterionId: number, points: number) => {
        setScores((prev) => ({ ...prev, [criterionId]: points }));
    };

    const handleReset = () => {
        const initialScores: Record<number, number> = {};
        criteria.forEach(c => {
            initialScores[c.id] = 10;
        });
        setScores(initialScores);
        setSelectedGuardId("");
        if (id) {
            navigate('/simulador-avaliacao');
        }
    };

    const calculateTotalScore = () => {
        return Object.values(scores).reduce((sum, v) => sum + v, 0);
    };

    const handleSave = async () => {
        if (!selectedGuardId) {
            toast({
                title: "Selecione um segurança",
                description: "É necessário selecionar um segurança para salvar a avaliação.",
                variant: "destructive",
            });
            return;
        }

        if (Object.keys(scores).length !== criteria.length) {
            toast({
                title: "Avaliação incompleta",
                description: "Por favor, avalie todos os critérios antes de salvar.",
                variant: "destructive",
            });
            return;
        }

        setSaving(true);
        try {
            const totalScore = calculateTotalScore();

            if (id) {
                const { error } = await (supabase as any)
                    .from('evaluations')
                    .update({
                        guard_id: selectedGuardId,
                        scores: scores,
                        total_score: totalScore,
                    })
                    .eq('id', id);

                if (error) throw error;

                toast({
                    title: "Avaliação atualizada!",
                    description: "As alterações foram salvas com sucesso.",
                });
                setRefreshTrigger(prev => prev + 1);
            } else {
                const { error } = await (supabase as any)
                    .from('evaluations')
                    .insert({
                        guard_id: selectedGuardId,
                        evaluator_id: profile!.id,
                        scores: scores,
                        total_score: totalScore,
                    });

                if (error) throw error;

                toast({
                    title: "Avaliação salva com sucesso!",
                    description: "A avaliação foi registrada no sistema.",
                });
                handleReset();
                setRefreshTrigger(prev => prev + 1);
            }
        } catch (error: any) {
            console.error('Error saving evaluation:', error);
            toast({
                title: "Erro ao salvar",
                description: error.message || "Não foi possível salvar a avaliação.",
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    const handleGeneratePDF = async () => {
        if (!selectedGuardId) return;

        // Determine if we have the full evaluation object or need to construct a temporary one
        let evaluationData: any = {
            scores: scores,
            total_score: calculateTotalScore(),
            created_at: new Date().toISOString(),
            guard: guards.find(g => g.id === selectedGuardId),
            evaluator: { name: profile?.name || 'Avaliador' }
        };

        if (id) {
            // If editing, we might want to fetch fresh or use what we have. 
            // We already fetched in fetchEvaluation, but didn't store the full object in state, just parts.
            // Ideally we should store the full fetched evaluation or re-fetch for PDF if needed, 
            // but constructing it from current state is faster and reflects UNSAVED changes too (preview).
            // However, for consistency, let's just use current state which is what the user sees.
        }

        if (!evaluationData.guard) {
            toast({ title: "Erro", description: "Dados do segurança não encontrados.", variant: "destructive" });
            return;
        }

        generateEvaluationPDF(evaluationData);
        toast({ title: "PDF Gerado", description: "O download do PDF foi iniciado." });
    };

    // Determine user role for AppLayout
    const userRole = role === 'super_admin' ? 'ADMIN' : (role === 'admin' ? 'ADMIN' : 'GUARD');
    const userRoleForLayout = userRole as 'ADMIN' | 'GUARD';

    return (
        <AppLayout
            title="Simulador de Avaliação"
            user={{
                name: profile?.name || 'Usuário',
                role: userRoleForLayout
            }}
        >
            <div className="space-y-6 animate-in fade-in duration-500 pb-20">
                <Card>
                    <CardHeader>
                        <CardTitle>Dados da Avaliação</CardTitle>
                        <CardDescription>Selecione o segurança e preencha os critérios abaixo</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                            <div className="flex-1">
                                <GuardCombobox
                                    guards={guards}
                                    value={selectedGuardId}
                                    onChange={setSelectedGuardId}
                                    disabled={loadingGuards || saving}
                                />
                            </div>

                            {selectedGuardId && (
                                <div className="flex gap-2 shrink-0 animate-in fade-in">
                                    <Button
                                        className="gap-2"
                                        size="default"
                                        onClick={handleSave}
                                        disabled={saving || loadingEvaluation}
                                    >
                                        {saving ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                {id ? "Atualizando..." : "Salvando..."}
                                            </>
                                        ) : (
                                            <>
                                                <Save className="h-4 w-4" />
                                                {id ? "Atualizar Avaliação" : "Salvar Avaliação"}
                                            </>
                                        )}
                                    </Button>

                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={handleGeneratePDF}
                                        disabled={saving || loadingEvaluation}
                                        title="Gerar PDF"
                                    >
                                        <FileText className="h-4 w-4 text-red-600" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Score Legend */}
                <div className="rounded-lg border bg-card/50 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Escala:
                        </span>
                        {SCORE_LABELS.map((s) => (
                            <span
                                key={s.points}
                                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-primary-foreground select-none"
                                style={{ backgroundColor: `hsl(var(--${s.color}))` }}
                            >
                                {s.label} – {s.points} pts
                            </span>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-8 lg:flex-row">
                    {/* Criteria List */}
                    <div className="flex-1 space-y-6">
                        {criteria.map((criterion) => (
                            <CriterionCard
                                key={criterion.id}
                                criterion={criterion}
                                selectedPoints={scores[criterion.id] ?? null}
                                onSelect={handleSelect}
                            />
                        ))}
                    </div>

                    {/* Sidebar Summary */}
                    <div className="w-full lg:w-80">
                        <div className="sticky top-6 space-y-4">
                            <ScoreSummary scores={scores} onReset={handleReset} />
                            <Button
                                className="w-full gap-2"
                                size="lg"
                                onClick={handleSave}
                                disabled={saving} // Only disable if actively saving
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Salvando...
                                    </>
                                ) : (
                                    <>
                                        <Save className="h-4 w-4" />
                                        Salvar Avaliação
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="pt-6">
                    <EvaluationList refreshTrigger={refreshTrigger} />
                </div>
            </div>

            {/* Fixed Mobile/Tablet Footer */}
            <SaveFooter onSave={handleSave} saving={saving} />
        </AppLayout>
    );
};

// Fixed footer component for saving
const SaveFooter = ({ onSave, saving }: { onSave: () => void, saving: boolean }) => (
    <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 lg:hidden">
        <div className="container flex items-center justify-between gap-4">
            <Button
                className="w-full gap-2"
                size="lg"
                onClick={onSave}
                disabled={saving}
            >
                {saving ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Salvando...
                    </>
                ) : (
                    <>
                        <Save className="h-4 w-4" />
                        Salvar Avaliação
                    </>
                )}
            </Button>
        </div>
    </div>
);

export default EvaluationSimulator;
