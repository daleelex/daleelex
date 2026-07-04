import { Prisma } from '../lib/prisma/generated/client';
/**
 * @class Repository - Generic Abstract class
 * T = The main Entity (e.g. Product, Alarm)
 * CreateDTO = The data needed for creation
 * UpdateDTO = The data needed for updates
 */
export abstract class Repository<T = any, CreateDTO = any, UpdateDTO = any> {
  abstract create(data: CreateDTO): Promise<T>;

  abstract findOne(whereOptions: any, selectOptions?: any): Promise<T | null>;

  abstract update(whereOptions: any, data: UpdateDTO): Promise<T>;

  abstract delete(whereOptions: any): Promise<T>;

  abstract findMany(whereOptions: any, orderByOptions: any, skip: number, take: number): Promise<T[]>;

  abstract deleteMany(whereOptions: any): Promise<Prisma.BatchPayload>;

  // Optional: Add a common count method since most modules use it for pagination
  abstract count(whereOptions: any): Promise<number>;
}

/**
 * @class Service - Generic Abstract class
 */
export abstract class Service<T = any, CreateDTO = any, UpdateDTO = any> {
  abstract create(dto: CreateDTO, userId?: string): Promise<any>;
  abstract findOne(id: string): Promise<T>;
  abstract update(id: string, dto: UpdateDTO): Promise<any>;
  abstract delete(id: string): Promise<any>;
  abstract findMany(query: any): Promise<{ data: T[]; meta: any }>;
}

/**
 * @class Controller
 */
export abstract class Controller {
  abstract findOne(id: string): Promise<any>;
  abstract update(id: string, data: any): Promise<any>;
  abstract delete(id: string): Promise<any>;
  abstract findMany(query: any): Promise<any>;
}
