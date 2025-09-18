import { Badge } from "@/components/ui/badge";
import { Team } from "@/lib/types";
import { TEAM_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface TeamBadgeProps {
  team: Team | string;
  className?: string;
}

export function TeamBadge({ team, className }: TeamBadgeProps) {
  const teamName = typeof team === 'string' ? team : team.name;
  const teamConfig = TEAM_COLORS.find(t => t.name === teamName);
  
  return (
    <Badge 
      variant="secondary" 
      className={cn(
        "font-medium",
        teamConfig?.color,
        className
      )}
    >
      {teamName}
    </Badge>
  );
}