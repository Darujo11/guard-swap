import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { TeamBadge } from '@/components/ui/team-badge';
import { ArrowRightLeft, Calendar, Clock, MapPin, User, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SwapRequestFormProps {
  currentUser: {
    id: string;
    name: string;
    team: string;
  };
  onClose?: () => void;
}

// Mock data - será substituído por dados reais do Supabase
const mockMyShifts = [
  {
    id: '1',
    date: '2024-01-15',
    period: 'DIURNO',
    location: 'Câmara Municipal',
    hours: '08:00 - 18:00'
  },
  {
    id: '2',
    date: '2024-01-20',
    period: 'DIURNO',
    location: 'Câmara Municipal',
    hours: '08:00 - 18:00'
  },
  {
    id: '3',
    date: '2024-01-25',
    period: 'NOTURNO',
    location: 'Museu do Legislativo',
    hours: '18:00 - 08:00'
  },
];

const mockOtherGuards = [
  {
    id: '2',
    name: 'Maria Santos',
    team: 'B',
    shifts: [
      {
        id: '4',
        date: '2024-01-16',
        period: 'NOTURNO',
        location: 'Museu do Legislativo',
        hours: '18:00 - 08:00'
      },
      {
        id: '5',
        date: '2024-01-18',
        period: 'DIURNO',
        location: 'Câmara Municipal',
        hours: '08:00 - 18:00'
      }
    ]
  },
  {
    id: '3',
    name: 'João Costa',
    team: 'C',
    shifts: [
      {
        id: '6',
        date: '2024-01-17',
        period: 'DIURNO',
        location: 'Câmara Municipal',
        hours: '08:00 - 18:00'
      }
    ]
  },
  {
    id: '4',
    name: 'Ana Lima',
    team: 'D',
    shifts: [
      {
        id: '7',
        date: '2024-01-19',
        period: 'NOTURNO',
        location: 'Museu do Legislativo',
        hours: '18:00 - 08:00'
      }
    ]
  }
];

export function SwapRequestForm({ currentUser, onClose }: SwapRequestFormProps) {
  const { toast } = useToast();
  const [selectedMyShift, setSelectedMyShift] = useState('');
  const [selectedGuard, setSelectedGuard] = useState('');
  const [selectedTargetShift, setSelectedTargetShift] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedGuardData = mockOtherGuards.find(g => g.id === selectedGuard);
  const myShift = mockMyShifts.find(s => s.id === selectedMyShift);
  const targetShift = selectedGuardData?.shifts.find(s => s.id === selectedTargetShift);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const handleSubmit = async () => {
    if (!selectedMyShift || !selectedGuard || !selectedTargetShift) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    // Simulação de envio - será substituído por API real
    setTimeout(() => {
      toast({
        title: "Solicitação enviada!",
        description: `Sua solicitação de troca com ${selectedGuardData?.name} foi enviada para aprovação.`,
      });
      
      setIsSubmitting(false);
      onClose?.();
    }, 2000);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5" />
          Solicitar Troca de Plantão
        </CardTitle>
        <CardDescription>
          Selecione um dos seus plantões e escolha um segurança de outra equipe para trocar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current User Info */}
        <div className="p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{currentUser.name}</span>
            <TeamBadge team={currentUser.team as any} />
          </div>
          <p className="text-sm text-muted-foreground">
            Solicitante da troca
          </p>
        </div>

        {/* My Shift Selection */}
        <div className="space-y-2">
          <Label>Meu plantão que desejo trocar *</Label>
          <Select value={selectedMyShift} onValueChange={setSelectedMyShift}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um dos seus plantões" />
            </SelectTrigger>
            <SelectContent>
              {mockMyShifts.map((shift) => (
                <SelectItem key={shift.id} value={shift.id}>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {formatDate(shift.date)} - {shift.period} - {shift.location}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Target Guard Selection */}
        <div className="space-y-2">
          <Label>Segurança para troca *</Label>
          <Select value={selectedGuard} onValueChange={(value) => {
            setSelectedGuard(value);
            setSelectedTargetShift(''); // Reset target shift when changing guard
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um segurança de outra equipe" />
            </SelectTrigger>
            <SelectContent>
              {mockOtherGuards.map((guard) => (
                <SelectItem key={guard.id} value={guard.id}>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {guard.name}
                    <TeamBadge team={guard.team as any} />
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Target Shift Selection */}
        {selectedGuardData && (
          <div className="space-y-2">
            <Label>Plantão do {selectedGuardData.name} *</Label>
            <Select value={selectedTargetShift} onValueChange={setSelectedTargetShift}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o plantão desejado" />
              </SelectTrigger>
              <SelectContent>
                {selectedGuardData.shifts.map((shift) => (
                  <SelectItem key={shift.id} value={shift.id}>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {formatDate(shift.date)} - {shift.period} - {shift.location}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Preview */}
        {myShift && targetShift && (
          <div className="p-4 border rounded-lg bg-muted/20">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Resumo da Troca
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p className="font-medium text-foreground">Você dará:</p>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {formatDate(myShift.date)}
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {myShift.period} ({myShift.hours})
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {myShift.location}
                </div>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">Você receberá:</p>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {formatDate(targetShift.date)}
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {targetShift.period} ({targetShift.hours})
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {targetShift.location}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reason */}
        <div className="space-y-2">
          <Label>Motivo da troca (opcional)</Label>
          <Textarea
            placeholder="Descreva o motivo da solicitação de troca..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button 
            onClick={handleSubmit}
            disabled={!selectedMyShift || !selectedGuard || !selectedTargetShift || isSubmitting}
            className="flex-1 gap-2"
          >
            <Send className="h-4 w-4" />
            {isSubmitting ? 'Enviando...' : 'Enviar Solicitação'}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}