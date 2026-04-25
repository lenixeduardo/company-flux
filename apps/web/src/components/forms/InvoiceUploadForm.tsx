'use client';
import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, FileCode, Upload, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { invoicesApi, suppliersApi } from '@/lib/api-client';
import { cn } from '@/lib/utils';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface UploadedInvoice {
  id: string;
  status: string;
}

interface InvoiceUploadFormProps {
  onSuccess: () => void;
}

export function InvoiceUploadForm({ onSuccess }: InvoiceUploadFormProps) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [supplierId, setSupplierId] = useState<string>('');
  const [uploadedInvoice, setUploadedInvoice] = useState<UploadedInvoice | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: () => suppliersApi.list({ limit: 100 }),
  });

  const suppliersList = suppliers?.data ?? suppliers ?? [];

  const uploadMutation = useMutation({
    mutationFn: () => invoicesApi.upload(file!, supplierId || undefined),
    onSuccess: (data: UploadedInvoice) => {
      setUploadedInvoice(data);
      setProcessingStatus('PENDING_PROCESSING');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err: any) => {
      const message =
        err?.response?.data?.message ?? 'Erro ao fazer upload. Tente novamente.';
      setFileError(message);
    },
  });

  // Poll invoice status after upload
  useEffect(() => {
    if (!uploadedInvoice?.id) return;
    if (processingStatus === 'PROCESSED' || processingStatus === 'MATCHED') {
      setTimeout(() => onSuccess(), 1500);
      return;
    }
    if (processingStatus === 'ERROR') return;
    if (pollCount >= 10) return; // max 10 polls (~30s)

    const timer = setTimeout(async () => {
      try {
        const updated = await invoicesApi.get(uploadedInvoice.id);
        setProcessingStatus(updated.status);
        setPollCount((c) => c + 1);
      } catch (_) {
        setPollCount((c) => c + 1);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [uploadedInvoice, processingStatus, pollCount, onSuccess]);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      setFileError(null);
      if (rejectedFiles.length > 0) {
        const err = rejectedFiles[0]?.errors?.[0];
        if (err?.code === 'file-too-large') {
          setFileError('Arquivo muito grande. Tamanho máximo: 10MB.');
        } else if (err?.code === 'file-invalid-type') {
          setFileError('Tipo de arquivo inválido. Aceitos: XML e PDF.');
        } else {
          setFileError('Arquivo inválido.');
        }
        return;
      }
      if (acceptedFiles.length > 0) {
        setFile(acceptedFiles[0]);
        setUploadedInvoice(null);
        setProcessingStatus(null);
        setPollCount(0);
      }
    },
    [],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/xml': ['.xml'],
      'application/xml': ['.xml'],
      'application/pdf': ['.pdf'],
    },
    maxSize: MAX_SIZE,
    multiple: false,
  });

  const isXml = file?.name.toLowerCase().endsWith('.xml');

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PENDING_PROCESSING':
        return { label: 'Processando...', className: 'text-yellow-700 bg-yellow-50 border-yellow-200' };
      case 'PROCESSED':
        return { label: 'Processado com sucesso!', className: 'text-blue-700 bg-blue-50 border-blue-200' };
      case 'MATCHED':
        return { label: 'Vinculado com sucesso!', className: 'text-green-700 bg-green-50 border-green-200' };
      case 'ERROR':
        return { label: 'Erro no processamento', className: 'text-red-700 bg-red-50 border-red-200' };
      default:
        return { label: status, className: 'text-gray-600 bg-gray-50 border-gray-200' };
    }
  };

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      {!uploadedInvoice ? (
        <div
          {...getRootProps()}
          className={cn(
            'relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
            isDragActive
              ? 'border-indigo-400 bg-indigo-50'
              : file
              ? 'border-green-400 bg-green-50'
              : 'border-gray-300 hover:border-indigo-300 hover:bg-gray-50',
          )}
        >
          <input {...getInputProps()} />
          {!file ? (
            <div className="space-y-3">
              <Upload className="h-10 w-10 text-gray-400 mx-auto" />
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {isDragActive
                    ? 'Solte o arquivo aqui...'
                    : 'Arraste XML ou PDF da NF-e aqui'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  ou clique para selecionar (máx. 10MB)
                </p>
              </div>
              <p className="text-xs text-gray-400">Formatos aceitos: .xml, .pdf</p>
            </div>
          ) : (
            <div className="flex items-center gap-3 justify-center">
              {isXml ? (
                <FileCode className="h-8 w-8 text-blue-500 flex-shrink-0" />
              ) : (
                <FileText className="h-8 w-8 text-red-500 flex-shrink-0" />
              )}
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  setFileError(null);
                }}
                className="ml-2 p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      ) : (
        // Status display after upload
        <div
          className={cn(
            'border rounded-xl p-5 text-center',
            getStatusLabel(processingStatus ?? '').className,
          )}
        >
          <p className="text-sm font-semibold">{getStatusLabel(processingStatus ?? '').label}</p>
          {(processingStatus === 'PENDING_PROCESSING' || pollCount > 0) &&
            processingStatus !== 'ERROR' &&
            processingStatus !== 'PROCESSED' &&
            processingStatus !== 'MATCHED' && (
              <p className="text-xs mt-1 opacity-80">
                Aguardando processamento... ({pollCount}/10 verificações)
              </p>
            )}
        </div>
      )}

      {/* File error */}
      {fileError && (
        <div className="flex items-start gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p className="text-sm">{fileError}</p>
        </div>
      )}

      {/* Supplier select */}
      {!uploadedInvoice && (
        <div className="space-y-1.5">
          <Label>Fornecedor (opcional)</Label>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger>
              <SelectValue placeholder="Associar a um fornecedor..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Nenhum</SelectItem>
              {suppliersList.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.tradeName ?? s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Upload button */}
      {!uploadedInvoice && (
        <Button
          type="button"
          disabled={!file || uploadMutation.isPending}
          onClick={() => uploadMutation.mutate()}
          className="w-full bg-indigo-600 hover:bg-indigo-700"
        >
          {uploadMutation.isPending ? (
            'Enviando...'
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Importar NF-e
            </>
          )}
        </Button>
      )}

      {uploadedInvoice &&
        processingStatus !== 'PENDING_PROCESSING' &&
        processingStatus !== 'PROCESSED' &&
        processingStatus !== 'MATCHED' && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setFile(null);
              setUploadedInvoice(null);
              setProcessingStatus(null);
              setPollCount(0);
              setFileError(null);
            }}
            className="w-full"
          >
            Enviar outro arquivo
          </Button>
        )}
    </div>
  );
}
