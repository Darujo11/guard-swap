import { Criterion, SCORE_LABELS } from "@/data/criteria";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CheckCircle } from "lucide-react";

interface CriterionCardProps {
    criterion: Criterion;
    selectedPoints: number | null;
    onSelect: (criterionId: number, points: number) => void;
}

const getScoreColor = (points: number) => {
    const entry = SCORE_LABELS.find((s) => s.points === points);
    return entry?.color ?? "muted";
};

const getScoreLabel = (points: number) => {
    const entry = SCORE_LABELS.find((s) => s.points === points);
    return entry?.label ?? "";
};

const CriterionCard = ({ criterion, selectedPoints, onSelect }: CriterionCardProps) => {
    return (
        <div className={`rounded-xl border bg-card p-6 shadow-sm transition-all duration-300 ${selectedPoints !== null ? "border-primary/30 shadow-md" : "border-border hover:shadow-md"
            }`}>
            <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">
                    <span className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                        {criterion.id}
                    </span>
                    {criterion.title}
                </h3>
                {selectedPoints !== null && (
                    <div className="flex items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-sm font-semibold text-primary-foreground`}
                            style={{
                                backgroundColor: `hsl(var(--${getScoreColor(selectedPoints)}))`
                            }}
                        >
                            {selectedPoints} pts – {getScoreLabel(selectedPoints)}
                        </span>
                        <CheckCircle className="h-5 w-5 text-success" />
                    </div>
                )}
            </div>

            <RadioGroup
                value={selectedPoints?.toString() ?? ""}
                onValueChange={(val) => onSelect(criterion.id, parseFloat(val))}
                className="space-y-2"
            >
                {criterion.options.map((option, idx) => (
                    <div
                        key={idx}
                        className={`flex items-start gap-3 rounded-lg border p-3 transition-all cursor-pointer hover:bg-muted/50 ${selectedPoints === option.points
                                ? "border-primary/40 bg-primary/5"
                                : "border-transparent"
                            }`}
                        onClick={() => onSelect(criterion.id, option.points)}
                    >
                        <RadioGroupItem
                            value={option.points.toString()}
                            id={`c${criterion.id}-o${idx}`}
                            className="mt-0.5 shrink-0"
                        />
                        <Label
                            htmlFor={`c${criterion.id}-o${idx}`}
                            className="cursor-pointer text-sm leading-relaxed text-card-foreground"
                        >
                            {option.label}
                        </Label>
                        <span className="ml-auto shrink-0 text-xs font-medium text-muted-foreground">
                            {option.points} pts
                        </span>
                    </div>
                ))}
            </RadioGroup>
        </div>
    );
};

export default CriterionCard;
