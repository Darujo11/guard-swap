import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle, Ban } from "lucide-react";
import { SwapStatus } from "@/lib/types";
import { SWAP_STATUS_CONFIG } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: SwapStatus;
  className?: string;
}

const iconMap = {
  Clock,
  CheckCircle,
  XCircle,
  Ban,
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = SWAP_STATUS_CONFIG[status];
  const Icon = iconMap[config.icon as keyof typeof iconMap];

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "gap-1.5 border font-medium",
        config.color,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}