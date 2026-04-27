import { Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';

const logger = new Logger('NfeXmlParser');

export interface NfeData {
  nfeAccessKey?: string;
  nfeNumber?: string;
  nfeSeries?: string;
  issuerCnpj?: string;
  issuerName?: string;
  totalValue?: number;
  taxValue?: number;
  issuedAt?: Date;
  items?: Array<{ description: string; quantity: number; unitValue: number; totalValue: number }>;
}

export function parseNfeXml(xmlContent: Buffer | string): NfeData {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseAttributeValue: true,
    });

    const result = parser.parse(xmlContent.toString('utf-8'));

    // Handle both nfeProc (with authorization) and NFe (raw) formats
    const root = result?.nfeProc ?? result?.NFe ?? result;
    const nfe = root?.NFe ?? root;
    const infNFe = nfe?.infNFe;

    if (!infNFe) {
      logger.warn('Could not find infNFe in XML');
      return {};
    }

    const emit = infNFe?.emit;
    const total = infNFe?.total?.ICMSTot;
    const ide = infNFe?.ide;
    const det = infNFe?.det;

    // Extract access key from Id attribute (format: NFe + 44 digits)
    const idAttr: string = infNFe?.['@_Id'] ?? '';
    const nfeAccessKey = idAttr.replace(/^NFe/, '').substring(0, 44);

    const data: NfeData = {
      nfeAccessKey: nfeAccessKey || undefined,
      nfeNumber: ide?.nNF?.toString(),
      nfeSeries: ide?.serie?.toString(),
      issuerCnpj: emit?.CNPJ?.toString().replace(/\D/g, ''),
      issuerName: emit?.xNome ?? emit?.xFant,
      totalValue: total?.vNF ? Number(total.vNF) : undefined,
      taxValue: total?.vTotTrib ? Number(total.vTotTrib) : undefined,
    };

    if (ide?.dhEmi) {
      try {
        data.issuedAt = new Date(ide.dhEmi);
      } catch (_) {
        // silently ignore parse errors on date
      }
    }

    // Parse items
    const items = Array.isArray(det) ? det : det ? [det] : [];
    data.items = items.map((item: any) => ({
      description: item?.prod?.xProd ?? 'N/A',
      quantity: Number(item?.prod?.qCom ?? 0),
      unitValue: Number(item?.prod?.vUnCom ?? 0),
      totalValue: Number(item?.prod?.vProd ?? 0),
    }));

    return data;
  } catch (error) {
    logger.error('Failed to parse NF-e XML', error);
    return {};
  }
}
