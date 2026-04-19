import type { FastifyInstance } from 'fastify';
import type { ServiceDocListResponse, ServiceDoc } from '@daleelex/shared';
import { prisma } from '../db.js';

export async function docsRoute(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>(
    '/services/:id/docs',
    async (req, reply): Promise<ServiceDocListResponse> => {
      const docs = await prisma.serviceDoc.findMany({
        where: { serviceId: req.params.id },
        select: { id: true, path: true, title: true },
        orderBy: { path: 'asc' },
      });

      if (docs.length === 0) {
        const exists = await prisma.service.count({ where: { id: req.params.id, deletedAt: null } });
        if (!exists) {
          reply.code(404);
          return { data: [] };
        }
      }

      return { data: docs };
    }
  );

  app.get<{ Params: { id: string; docId: string } }>(
    '/services/:id/docs/:docId',
    async (req, reply): Promise<ServiceDoc> => {
      const doc = await prisma.serviceDoc.findFirst({
        where: { id: Number(req.params.docId), serviceId: req.params.id },
      });

      if (!doc) {
        reply.code(404);
        throw new Error('Doc not found');
      }

      return {
        id: doc.id,
        path: doc.path,
        title: doc.title,
        contentMd: doc.contentMd,
        fetchedAt: doc.fetchedAt.toISOString(),
      };
    }
  );
}
