'use client';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TrendingUp, TrendingDown } from 'lucide-react';
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
import { transactionsApi, categoriesApi, bankAccountsApi } from '@/lib/api-client';
import { cn } from '@/lib/utils';

const schema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  description: z.string().min(1, 'Descrição obrigatória'),
  amount: z.number({ invalid_type_error: 'Valor obrigatório' }).positive('Valor deve ser positivo'),
  dueDate: z.string().min(1, 'Data de vencimento obrigatória'),
  competenceDate: z.string().min(1, 'Data de competência obrigatória'),
  categoryId: z.string().min(1, 'Categoria obrigatória'),
  bankAccountId: z.string().min(1, 'Conta bancária obrigatória'),
  notes: z.string().optional(),
});

type TransactionFormData = z.infer<typeof schema>;

interface TransactionFormProps {
  onSuccess: () => void;
}

function formatAmountDisplay(value: number | undefined): string {
  if (!value) return '';
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function parseAmount(raw: string): number {
  // Remove all non-digit and non-comma chars, then replace comma with dot
  const cleaned = raw.replace(/[^\d,]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

export function TransactionForm({ onSuccess }: TransactionFormProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'EXPENSE',
      dueDate: new Date().toISOString().split('T')[0],
      competenceDate: new Date().toISOString().split('T')[0],
    },
  });

  const selectedType = watch('type');
  const dueDate = watch('dueDate');

  // Sync competenceDate when dueDate changes (if competenceDate is empty)
  useEffect(() => {
    if (dueDate) {
      setValue('competenceDate', dueDate);
    }
  }, [dueDate, setValue]);

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
  });

  const { data: bankAccounts } = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: bankAccountsApi.list,
  });

  const filteredCategories = (categories ?? []).filter(
    (c: any) => c.type === selectedType || c.type === 'BOTH',
  );

  const mutation = useMutation({
    mutationFn: transactionsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-monthly-comparison'] });
      onSuccess();
    },
  });

  const onSubmit = (data: TransactionFormData) => {
    mutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Type Toggle */}
      <div className="space-y-1.5">
        <Label>Tipo</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setValue('type', 'INCOME')}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg border-2 py-3 text-sm font-semibold transition-all',
              selectedType === 'INCOME'
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-gray-200 bg-white text-gray-500 hover:border-green-200',
            )}
          >
            <TrendingUp className="h-4 w-4" />
            Receita
          </button>
          <button
            type="button"
            onClick={() => setValue('type', 'EXPENSE')}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg border-2 py-3 text-sm font-semibold transition-all',
              selectedType === 'EXPENSE'
                ? 'border-red-500 bg-red-50 text-red-700'
                : 'border-gray-200 bg-white text-gray-500 hover:border-red-200',
            )}
          >
            <TrendingDown className="h-4 w-4" />
            Despesa
          </button>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="description">Descrição</Label>
        <Input
          id="description"
          placeholder="Ex: Pagamento de fornecedor..."
          {...register('description')}
        />
        {errors.description && (
          <p className="text-xs text-red-500">{errors.description.message}</p>
        )}
      </div>

      {/* Amount */}
      <div className="space-y-1.5">
        <Label htmlFor="amount">Valor (R$)</Label>
        <Input
          id="amount"
          type="text"
          inputMode="decimal"
          placeholder="0,00"
          onBlur={(e) => {
            const parsed = parseAmount(e.target.value);
            setValue('amount', parsed, { shouldValidate: true });
            e.target.value = parsed > 0 ? formatAmountDisplay(parsed) : '';
          }}
          onChange={(e) => {
            const parsed = parseAmount(e.target.value);
            setValue('amount', parsed);
          }}
        />
        {errors.amount && (
          <p className="text-xs text-red-500">{errors.amount.message}</p>
        )}
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="dueDate">Vencimento</Label>
          <Input id="dueDate" type="date" {...register('dueDate')} />
          {errors.dueDate && (
            <p className="text-xs text-red-500">{errors.dueDate.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="competenceDate">Competência</Label>
          <Input id="competenceDate" type="date" {...register('competenceDate')} />
          {errors.competenceDate && (
            <p className="text-xs text-red-500">{errors.competenceDate.message}</p>
          )}
        </div>
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <Label>Categoria</Label>
        <Select onValueChange={(v) => setValue('categoryId', v, { shouldValidate: true })}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma categoria" />
          </SelectTrigger>
          <SelectContent>
            {filteredCategories.map((cat: any) => (
              <SelectItem key={cat.id} value={cat.id}>
                <span className="flex items-center gap-2">
                  {cat.color && (
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: cat.color }}
                    />
                  )}
                  {cat.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.categoryId && (
          <p className="text-xs text-red-500">{errors.categoryId.message}</p>
        )}
      </div>

      {/* Bank Account */}
      <div className="space-y-1.5">
        <Label>Conta Bancária</Label>
        <Select onValueChange={(v) => setValue('bankAccountId', v, { shouldValidate: true })}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma conta" />
          </SelectTrigger>
          <SelectContent>
            {(bankAccounts ?? []).map((acc: any) => (
              <SelectItem key={acc.id} value={acc.id}>
                {acc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.bankAccountId && (
          <p className="text-xs text-red-500">{errors.bankAccountId.message}</p>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">Observações (opcional)</Label>
        <textarea
          id="notes"
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
          placeholder="Anotações adicionais..."
          {...register('notes')}
        />
      </div>

      {mutation.isError && (
        <p className="text-sm text-red-500 text-center">
          Erro ao salvar. Tente novamente.
        </p>
      )}

      <Button
        type="submit"
        disabled={isSubmitting || mutation.isPending}
        className={cn(
          'w-full',
          selectedType === 'INCOME'
            ? 'bg-green-600 hover:bg-green-700'
            : 'bg-red-600 hover:bg-red-700',
        )}
      >
        {mutation.isPending
          ? 'Salvando...'
          : selectedType === 'INCOME'
          ? 'Salvar Receita'
          : 'Salvar Despesa'}
      </Button>
    </form>
  );
}
