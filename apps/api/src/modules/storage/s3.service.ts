import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(private config: ConfigService) {
    this.s3 = new S3Client({
      region: config.get<string>('AWS_REGION') ?? 'sa-east-1',
      credentials: {
        accessKeyId: config.get<string>('AWS_ACCESS_KEY_ID') ?? '',
        secretAccessKey: config.get<string>('AWS_SECRET_ACCESS_KEY') ?? '',
      },
    });
    this.bucket = config.get<string>('AWS_S3_BUCKET') ?? 'flux-invoices';
  }

  async upload(
    file: Express.Multer.File,
    tenantId: string,
  ): Promise<{ key: string; bucket: string; hash: string }> {
    const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? 'bin';
    const key = `tenants/${tenantId}/invoices/${hash}.${ext}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ServerSideEncryption: 'AES256',
        Metadata: {
          tenantId,
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
        },
      }),
    );

    this.logger.log(`Uploaded file ${key} (${file.size} bytes)`);
    return { key, bucket: this.bucket, hash };
  }

  async getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
  }

  async delete(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    this.logger.log(`Deleted file ${key}`);
  }
}
