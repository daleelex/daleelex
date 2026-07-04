import { Request } from 'express';
import { HttpException } from './exceptions/exception';
import { Role, SupportedCurrency } from '../config/enums';

export interface LogMessageOptions {
  responseTime: number;
  body?: object;
  error?: HttpException | Error;
}

export interface Exception {
  status: number;
  errorCode: string;
  errorMessage: Message;
}

export interface Message {
  en: string;
  ar: string;
  fr: string;
}

export interface Filter {
  name: string;
  price: [string];
}

export interface Query {
  page?: string | number;
  limit?: string | number;
  skip?: string | number;
  search?: string;
  sortBy?: string;
  sort?: 'asc' | 'desc' | 'ASC' | 'DESC';
  filter?: string; // JSON string from frontend
  currentCurrency?: string;
}

export interface Success {
  success: boolean;
}

export interface PrismaGeneralOptions {
  skip: number;
  take: number;
}

export interface UserHeader {
  id: string;
  username: string;
  role: string;
}

export interface LoggerErrorMetadata {
  err: HttpException | Error;
}

// export interface CreateArgs {
//   body: CategoryEntity;
// }

// export interface UpdateArgs {
//   id: string;
//   body: PrismaUpdateCategory;
// }

// export interface FindOneArgs {
//   id: string;
// }

// export interface FindManyArgs {
//   query?: Query;
// }

/**
 * Interface for user in the request header
 */
export interface User {
  role: Role;
  id: string;
}

/**
 * Interface for custom http requests
 */
export interface HttpRequest extends Request {
  user: User;
}
