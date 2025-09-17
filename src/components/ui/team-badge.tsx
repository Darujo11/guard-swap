import { Badge } from "@/components/ui/badge";
import { TeamName } from "@/lib/types";
import { TEAMS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface TeamBadgeProps {
  team: TeamName;
  className?: string;
}

export function TeamBadge({ team, className }: TeamBadgeProps) {
  const teamConfig = TEAMS.find(t => t.name === team);
  
  return (
    <Badge 
      variant="secondary" 
      className={cn(
        "font-medium",
        teamConfig?.color,
        className
      )}
    >
      Equipe {team}
    </Badge>
  );
}