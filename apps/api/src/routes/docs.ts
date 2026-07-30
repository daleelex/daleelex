import type { FastifyInstance } from 'fastify';
import type {
  ServiceDocListResponse,
  ServiceDoc,
  TechDocsIndexResponse,
  UploadServiceDocRequest,
  UploadServiceDocResponse,
  UpdateServiceDocRequest,
} from '@daleelex/shared';
import { prisma } from '../db.js';
import { requireClerkUser } from '../clerkAuth.js';
import {
  manualDocPath,
  markdownTitle,
  MAX_MARKDOWN_BYTES,
  validateMarkdownUpload,
} from '../docUpload.js';

function toServiceDoc(doc: {
  id: number;
  path: string;
  title: string;
  contentMd: string;
  sourceRepository: string | null;
  sourceSha: string | null;
  uploadedByUserId: string | null;
  updatedByUserId: string | null;
  fetchedAt: Date;
}): ServiceDoc {
  return {
    id: doc.id,
    path: doc.path,
    title: doc.title,
    contentMd: doc.contentMd,
    sourceRepository: doc.sourceRepository,
    sourceSha: doc.sourceSha,
    uploadedByUserId: doc.uploadedByUserId,
    updatedByUserId: doc.updatedByUserId,
    fetchedAt: doc.fetchedAt.toISOString(),
  };
}

export async function docsRoute(app: FastifyInstance) {
  app.get('/docs', async (): Promise<TechDocsIndexResponse> => {
    const services = await prisma.service.findMany({
      where: { deletedAt: null, docs: { some: {} } },
      select: {
        id: true,
        name: true,
        type: true,
        tier: true,
        docs: {
          select: { id: true, path: true, title: true },
          orderBy: { path: 'asc' },
        },
      },
      orderBy: [{ tier: 'asc' }, { name: 'asc' }],
    });

    return {
      data: services.map((s) => ({
        service: { id: s.id, name: s.name, type: s.type as any, tier: s.tier as any },
        docs: s.docs,
      })),
    };
  });

  app.get<{ Params: { id: string } }>(
    '/services/:id/docs',
    async (req, reply): Promise<ServiceDocListResponse> => {
      const docs = await prisma.serviceDoc.findMany({
        where: { serviceId: req.params.id, service: { deletedAt: null } },
        select: { id: true, path: true, title: true },
        orderBy: { path: 'asc' },
      });

      if (docs.length === 0) {
        const exists = await prisma.service.count({
          where: { id: req.params.id, deletedAt: null },
        });
        if (!exists) {
          reply.code(404);
          return { data: [] };
        }
      }

      return { data: docs };
    },
  );

  app.get<{ Params: { id: string; docId: string } }>(
    '/services/:id/docs/:docId',
    async (req, reply): Promise<ServiceDoc> => {
      const doc = await prisma.serviceDoc.findFirst({
        where: {
          id: Number(req.params.docId),
          serviceId: req.params.id,
          service: { deletedAt: null },
        },
      });

      if (!doc) {
        reply.code(404);
        throw new Error('Doc not found');
      }

      return toServiceDoc(doc);
    },
  );

  app.post<{ Params: { id: string }; Body: UploadServiceDocRequest }>(
    '/services/:id/docs',
    {
      preHandler: requireClerkUser,
      // Fastify's default body limit equals MAX_MARKDOWN_BYTES, but the JSON
      // envelope (escaping, quotes, sibling fields) inflates a near-limit file
      // past it. Double the transport cap; the byte-accurate 1 MiB check on the
      // decoded content stays in validateMarkdownUpload.
      bodyLimit: MAX_MARKDOWN_BYTES * 2,
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', minLength: 1 } },
        },
        body: {
          type: 'object',
          required: ['filename', 'contentMd', 'overwrite'],
          additionalProperties: false,
          properties: {
            filename: { type: 'string', minLength: 1, maxLength: 128 },
            contentMd: { type: 'string', minLength: 1, maxLength: MAX_MARKDOWN_BYTES },
            overwrite: { type: 'boolean' },
          },
        },
      },
    },
    async (req, reply): Promise<UploadServiceDocResponse> => {
      const validationError = validateMarkdownUpload(req.body.filename, req.body.contentMd);
      if (validationError) {
        reply.code(422);
        throw new Error(validationError);
      }

      const service = await prisma.service.findFirst({
        where: { id: req.params.id, deletedAt: null },
        select: { id: true },
      });
      if (!service) {
        reply.code(404);
        throw new Error(`Service "${req.params.id}" not found.`);
      }

      const path = manualDocPath(req.body.filename);
      const existing = await prisma.serviceDoc.findUnique({
        where: { serviceId_path: { serviceId: service.id, path } },
        select: { id: true },
      });

      if (existing && !req.body.overwrite) {
        reply.code(409);
        throw new Error(`"${req.body.filename}" already exists. Confirm replacement to continue.`);
      }

      const now = new Date();
      const doc = existing
        ? await prisma.serviceDoc.update({
            where: { id: existing.id },
            data: {
              title: markdownTitle(req.body.contentMd, req.body.filename),
              contentMd: req.body.contentMd,
              sourceRepository: null,
              sourceSha: null,
              // An overwrite replaces the content wholesale, so the uploader
              // changes too; it also counts as the last modification.
              uploadedByUserId: req.clerkUserId!,
              updatedByUserId: req.clerkUserId!,
              fetchedAt: now,
            },
          })
        : await prisma.serviceDoc.create({
            data: {
              serviceId: service.id,
              path,
              title: markdownTitle(req.body.contentMd, req.body.filename),
              contentMd: req.body.contentMd,
              uploadedByUserId: req.clerkUserId!,
              fetchedAt: now,
            },
          });

      reply.code(existing ? 200 : 201);
      return { data: toServiceDoc(doc), operation: existing ? 'updated' : 'created' };
    },
  );

  app.patch<{ Params: { id: string; docId: string }; Body: UpdateServiceDocRequest }>(
    '/services/:id/docs/:docId',
    {
      preHandler: requireClerkUser,
      bodyLimit: MAX_MARKDOWN_BYTES * 2,
      schema: {
        params: {
          type: 'object',
          required: ['id', 'docId'],
          properties: {
            id: { type: 'string', minLength: 1 },
            docId: { type: 'string', pattern: '^[0-9]+$' },
          },
        },
        body: {
          type: 'object',
          required: ['filename', 'contentMd'],
          additionalProperties: false,
          properties: {
            filename: { type: 'string', minLength: 1, maxLength: 128 },
            contentMd: { type: 'string', minLength: 1, maxLength: MAX_MARKDOWN_BYTES },
          },
        },
      },
    },
    async (req, reply): Promise<ServiceDoc | void> => {
      const validationError = validateMarkdownUpload(req.body.filename, req.body.contentMd);
      if (validationError) {
        return reply.code(422).send({
          error: { code: 'invalid_document', message: validationError, details: {} },
        });
      }

      const doc = await prisma.serviceDoc.findFirst({
        where: {
          id: Number(req.params.docId),
          serviceId: req.params.id,
          service: { deletedAt: null },
        },
      });
      if (!doc) {
        return reply.code(404).send({
          error: { code: 'doc_not_found', message: 'Doc not found.', details: {} },
        });
      }
      if (doc.sourceRepository) {
        return reply.code(409).send({
          error: {
            code: 'repository_managed_document',
            message: 'This document is managed in its source repository.',
            details: { repository: doc.sourceRepository, path: doc.path },
          },
        });
      }

      const path = manualDocPath(req.body.filename);
      const collision = await prisma.serviceDoc.findFirst({
        where: { serviceId: req.params.id, path, id: { not: doc.id } },
        select: { id: true },
      });
      if (collision) {
        return reply.code(409).send({
          error: {
            code: 'document_path_conflict',
            message: `"${req.body.filename}" already exists for this service.`,
            details: {},
          },
        });
      }

      const updated = await prisma.serviceDoc.update({
        where: { id: doc.id },
        data: {
          path,
          title: markdownTitle(req.body.contentMd, req.body.filename),
          contentMd: req.body.contentMd,
          // uploadedByUserId keeps pointing at the original uploader;
          // updatedByUserId records who touched it last.
          updatedByUserId: req.clerkUserId!,
          fetchedAt: new Date(),
        },
      });
      return toServiceDoc(updated);
    },
  );
}
