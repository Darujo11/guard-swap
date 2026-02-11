import { criteria, SCORE_LABELS } from "@/data/criteria";
import { Trophy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface ScoreSummaryProps {
    scores: Record<number, number>;
    onReset: () => void;
}

const ScoreSummary = ({ scores, onReset }: ScoreSummaryProps) => {
    const totalPossible = criteria.length * 10;
    const answeredCount = Object.keys(scores).length;
    const totalScore = Object.values(scores).reduce((sum, v) => sum + v, 0);
    const allAnswered = answeredCount === criteria.length;
    const percentage = totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0;

    const getOverallLabel = () => {
        if (!allAnswered) return null;
        const avg = totalScore / criteria.length;
        if (avg >= 9) return SCORE_LABELS[0];
        if (avg >= 7) return SCORE_LABELS[1];
        if (avg >= 4) return SCORE_LABELS[2];
        if (avg >= 2) return SCORE_LABELS[3];
        return SCORE_LABELS[4];
    };

    const overall = getOverallLabel();

    return (
        <div className="sticky top-6 space-y-5 rounded-xl border bg-card p-6 shadow-lg">
            <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
                    <Trophy className="h-6 w-6 text-primary" />
                    Total Geral (25)
                </h2>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onReset}
                    className="text-muted-foreground hover:text-foreground"
                >
                    <RotateCcw className="mr-1 h-4 w-4" />
                    Limpar
                </Button>
            </div>

            <div className="text-center">
                <div className="text-5xl font-extrabold text-primary">
                    {totalScore.toFixed(1)}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                    de {totalPossible} pontos possíveis
                </div>
            </div>

            <Progress value={percentage} className="h-3" />

            <div className="flex justify-between text-sm text-muted-foreground">
                <span>{answeredCount} de {criteria.length} critérios</span>
                <span>{percentage.toFixed(0)}%</span>
            </div>

            {allAnswered && overall && (
                <div
                    className="rounded-lg p-4 text-center transition-all duration-500"
                    style={{ backgroundColor: `hsl(var(--${overall.color}) / 0.15)` }}
                >
                    <div
                        className="text-lg font-bold"
                        style={{ color: `hsl(var(--${overall.color}))` }}
                    >
                        {overall.label}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Classificação geral</p>
                </div>
            )}

            {allAnswered && (
                <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Resumo por critério
                    </h4>
                    {criteria.map((c) => {
                        const pts = scores[c.id] ?? 0;
                        const scoreInfo = SCORE_LABELS.find((s) => s.points === pts);
                        return (
                            <div key={c.id} className="flex items-center justify-between text-sm">
                                <span className="truncate text-card-foreground">{c.id}. {c.title}</span>
                                <span
                                    className="ml-2 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground"
                                    style={{ backgroundColor: `hsl(var(--${scoreInfo?.color ?? "muted"}))` }}
                                >
                                    {scoreInfo?.label ?? "—"} – {pts % 1 === 0 ? pts : pts.toFixed(1)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ScoreSummary;
