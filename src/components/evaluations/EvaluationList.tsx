import { useState, useEffect } from "react";
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from "@/hooks/use-toast";
import { Evaluation } from "@/lib/types";
import { SCORE_LABELS, criteria } from "@/data/criteria";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { Search, Calendar, User, Eye, FileText, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { generateEvaluationPDF, generateEvaluationsSummaryPDF } from "@/utils/pdfGenerator";

interface EvaluationListProps {
    limit?: number;
    showHeader?: boolean;
    refreshTrigger?: number; // Prop to trigger refetch
}

export const EvaluationList = ({ limit, showHeader = true, refreshTrigger = 0 }: EvaluationListProps) => {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const { toast } = useToast();
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        fetchEvaluations();
    }, [profile?.id, refreshTrigger]); // Refetch when trigger changes

    const fetchEvaluations = async () => {
        if (!profile?.id) return;
        try {
            let query = (supabase as any)
                .from('evaluations')
                .select(`
                    *,
                    guard:profiles!evaluations_guard_id_fkey(name),
                    evaluator:profiles!evaluations_evaluator_id_fkey(name)
                `)
                .order('created_at', { ascending: false });

            if (limit) {
                query = query.limit(limit);
            }

            // @ts-ignore
            const { data, error } = await query;

            if (error) throw error;
            setEvaluations((data || []) as any[]);
        } catch (error) {
            console.error('Error fetching evaluations:', error);
            toast({
                title: "Erro ao carregar histórico",
                description: "Não foi possível carregar o histórico de avaliações.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const getClassification = (totalScore: number) => {
        const avg = totalScore / criteria.length;
        if (avg >= 9) return SCORE_LABELS[0];
        if (avg >= 7) return SCORE_LABELS[1];
        if (avg >= 4) return SCORE_LABELS[2];
        if (avg >= 2) return SCORE_LABELS[3];
        return SCORE_LABELS[4];
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Tem certeza que deseja excluir esta avaliação?")) return;

        try {
            // @ts-ignore
            const { error } = await supabase
                .from('evaluations')
                .delete()
                .eq('id', id);

            if (error) throw error;

            toast({
                title: "Avaliação excluída",
                description: "O registro foi removido com sucesso.",
            });
            fetchEvaluations();
        } catch (error) {
            console.error('Error deleting evaluation:', error);
            toast({
                title: "Erro ao excluir",
                description: "Não foi possível excluir a avaliação.",
                variant: "destructive",
            });
        }
    };

    const filteredEvaluations = evaluations.filter(ev =>
        ev.guard?.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const Content = (
        <>
            {loading ? (
                <div className="text-center py-10">Carregando...</div>
            ) : filteredEvaluations.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                    Nenhuma avaliação encontrada.
                </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Segurança</TableHead>
                            <TableHead>Pontuação</TableHead>

                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredEvaluations.map((ev) => {
                            return (
                                <TableRow key={ev.id}>
                                    <TableCell className="font-medium flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        {format(new Date(ev.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-muted-foreground" />
                                            {ev.guard?.name || "Desconhecido"}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-bold text-primary">
                                            {ev.total_score.toFixed(1)}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-bold text-primary">
                                            {ev.total_score.toFixed(1)}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => generateEvaluationPDF(ev)}
                                                title="Gerar PDF"
                                            >
                                                <FileText className="h-4 w-4 text-muted-foreground hover:text-red-600" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => navigate(`/simulador-avaliacao/${ev.id}`)}
                                                title="Editar"
                                            >
                                                <Eye className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(ev.id)}
                                                title="Excluir"
                                            >
                                                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            )}
        </>
    );

    if (!showHeader) {
        return (
            <div className="space-y-4">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por segurança..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
                {Content}
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Avaliações Realizadas</CardTitle>
                        <CardDescription>Consulte o histórico de todas as avaliações registradas.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por segurança..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => generateEvaluationsSummaryPDF(filteredEvaluations)}
                            title="Exportar Relatório PDF"
                            disabled={loading || filteredEvaluations.length === 0}
                        >
                            <FileText className="h-4 w-4 text-red-600" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {Content}
            </CardContent>
        </Card>
    );
};
