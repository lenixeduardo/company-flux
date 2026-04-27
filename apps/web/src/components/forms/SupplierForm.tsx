'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { suppliersApi } from '@/lib/api-client';
import { maskCNPJ } from '@/lib/utils';

const SUPPLIER_CATEGORIES = [
  { value: 'SERVICES', label: 'Serviços' },
  { value: 'PRODUCTS', label: 'Produtos' },
  { value: 'UTILITIES', label: 'Utilidades' },
  { value: 'RENT', label: 'Aluguel' },
  { value: 'PAYROLL', label: 'Folha de Pagamento' },
  { value: 'TAXES', label: 'Impostos' },
  { value: 'MAINTENANCE', label: 'Manutenção' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'TECHNOLOGY', label: 'Tecnologia' },
  { value: 'LOGISTICS', label: 'Logística' },
  { value: 'OTHER', label: 'Outros' },
];

const schema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  tradeName: z.string().optional(),
  cnpj: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  category: z.string().min(1, 'Categoria obrigatória'),
  paymentTermDays: z
    .number({ invalid_type_error: 'Informe prazo de pagamento' })
    .int()
    .min(0)
    .default(30),
  notes: z.string().optional(),
});

export type SupplierFormData = z.infer<typeof schema>;

interface Supplier {
  id?: string;
  name?: string;
  tradeName?: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  category?: string;
  paymentTermDays?: number;
  notes?: string;
}

interface SupplierFormProps {
  defaultValues?: Partial<Supplier>;
  onSuccess: () => void;
}

export function SupplierForm({ defaultValues, onSuccess }: SupplierFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!defaultValues?.id;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      tradeName: defaultValues?.tradeName ?? '',
      cnpj: defaultValues?.cnpj ?? '',
      email: defaultValues?.email ?? '',
      phone: defaultValues?.phone ?? '',
      category: defaultValues?.category ?? '',
      paymentTermDays: defaultValues?.paymentTermDays ?? 30,
      notes: defaultValues?.notes ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (data: SupplierFormData) =>
      isEditing
        ? suppliersApi.update(defaultValues!.id!, data)
        : suppliersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      onSuccess();
    },
  });

  const onSubmit = (data: SupplierFormData) => mutation.mutate(data);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="name">Razão Social *</Label>
          <Input id="name" placeholder="Nome da empresa..." {...register('name')} />
          {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="tradeName">Nome Fantasia</Label>
          <Input
            id="tradeName"
            placeholder="Nome comercial (opcional)"
            {...register('tradeName')}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cnpj">CNPJ / CPF</Label>
          <Input
            id="cnpj"
            placeholder="00.000.000/0000-00"
            {...register('cnpj')}
            onChange={(e) => {
              const masked = maskCNPJ(e.target.value);
              setValue('cnpj', masked);
              e.target.value = masked;
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Telefone</Label>
          <Input id="phone" placeholder="(00) 00000-0000" {...register('phone')} />
        </div>

        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" placeholder="contato@empresa.com" {...register('email')} />
          {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Categoria *</Label>
          <Select
            defaultValue={defaultValues?.category}
            onValueChange={(v) => setValue('category', v, { shouldValidate: true })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {SUPPLIER_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.category && (
            <p className="text-xs text-red-500">{errors.category.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="paymentTermDays">Prazo de Pagamento (dias)</Label>
          <Input
            id="paymentTermDays"
            type="number"
            min={0}
            placeholder="30"
            {...register('paymentTermDays', { valueAsNumber: true })}
          />
          {errors.paymentTermDays && (
            <p className="text-xs text-red-500">{errors.paymentTermDays.message}</p>
          )}
        </div>

        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="notes">Observações</Label>
          <textarea
            id="notes"
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            placeholder="Anotações adicionais..."
            {...register('notes')}
          />
        </div>
      </div>

      {mutation.isError && (
        <p className="text-sm text-red-500 text-center">Erro ao salvar. Tente novamente.</p>
      )}

      <Button
        type="submit"
        disabled={isSubmitting || mutation.isPending}
        className="w-full bg-indigo-600 hover:bg-indigo-700"
      >
        {mutation.isPending ? 'Salvando...' : isEditing ? 'Atualizar Fornecedor' : 'Cadastrar Fornecedor'}
      </Button>
    </form>
  );
}
