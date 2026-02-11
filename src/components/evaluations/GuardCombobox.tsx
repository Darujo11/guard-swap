import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Profile } from "@/lib/types"

interface GuardComboboxProps {
    guards: Profile[]
    value?: string
    onChange: (value: string) => void
    disabled?: boolean
}

export function GuardCombobox({ guards, value, onChange, disabled }: GuardComboboxProps) {
    const [open, setOpen] = React.useState(false)

    const selectedGuard = guards.find((guard) => guard.id === value)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                    disabled={disabled}
                >
                    {selectedGuard ? selectedGuard.name : "Selecione um segurança..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0">
                <Command>
                    <CommandInput placeholder="Buscar segurança..." />
                    <CommandList>
                        <CommandEmpty>Nenhum segurança encontrado.</CommandEmpty>
                        <CommandGroup>
                            {guards.map((guard) => (
                                <CommandItem
                                    key={guard.id}
                                    value={guard.name}
                                    onSelect={() => {
                                        onChange(guard.id === value ? "" : guard.id)
                                        setOpen(false)
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === guard.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {guard.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
