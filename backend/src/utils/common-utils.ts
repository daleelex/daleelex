import { Filter, Query } from '../global/global.interfaces';
import values from '../config/default-values';
import { PrismaSorting } from '../config/enums';

interface AggregationConfig {
  defaultSortKey: string;
  searchFields: string[];
  maxLimit?: number;
}

/**
 * @function handleAggregationOptions - Orchestrates pagination, filtering, and sorting logic
 * @description Maps frontend Query parameters to Prisma-compatible database options.
 * Enforces a hard ceiling on `take` to prevent full-table scans on large datasets.
 */
export const handleAggregationOptions = (
  options: Query,
  config: AggregationConfig = { defaultSortKey: 'createdAt', searchFields: [], maxLimit: 100 },
): any => {
  const { search, sortBy, sort, limit, filter } = options;

  const maxLimit = config.maxLimit ?? 100;

  // 1. Pagination — enforce ceiling
  const page = options.page ? Math.max(1, Number(options.page)) : 1;
  const take = limit ? Math.min(Math.max(1, Number(limit)), maxLimit) : 10;
  const skip = (page - 1) * take;

  // 2. Deep pagination guard — reject skip > 10,000 to prevent slow offset scans
  if (skip > 10000) {
    return {
      where: { id: 'BLOCKED_DEEP_PAGINATION' },
      orderBy: { [config.defaultSortKey]: PrismaSorting.DESC },
      skip: 0,
      take: 0,
      page,
    };
  }

  // 3. Dynamic filtering
  let where: any = {};
  if (filter) {
    try {
      const filterObj = JSON.parse(filter);
      where = createFilteringWhereClauseObject(filterObj);
    } catch {
      where = {};
    }
  }

  // 4. Search — use startsWith for short queries (index-friendly), contains for 3+ chars
  if (search && config.searchFields.length > 0) {
    const trimmed = search.trim();
    if (trimmed.length > 0) {
      const mode = 'insensitive';
      // Short searches use startsWith (B-tree friendly)
      // Longer searches use contains (trigram index friendly)
      const matchType = trimmed.length < 3 ? 'startsWith' : 'contains';
      where['OR'] = config.searchFields.map((field) => ({
        [field]: { [matchType]: trimmed, mode },
      }));
    }
  }

  // 5. Sorting — whitelist validation
  const finalSortBy = sortBy && values().allowedSortingFields.includes(sortBy) ? sortBy : config.defaultSortKey;
  const sortValue = sort && sort.toLowerCase() === 'asc' ? PrismaSorting.ASC : PrismaSorting.DESC;
  const orderBy = { [finalSortBy]: sortValue };

  return { where, orderBy, skip, take, page };
};

/**
 * @function createFilteringWhereClauseObject - Builds Prisma where clauses from filter object
 * @description Whitelists operations and sanitizes input to prevent injection
 */
const createFilteringWhereClauseObject = (filter: Filter) => {
  const whereClause: any = {};

  Object.keys(filter).forEach((key) => {
    const value = filter[key];

    // Range/numeric filters
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const operation = Object.keys(value)[0].toLowerCase();
      if (values().allowedOperations.includes(operation)) {
        whereClause[key] = generateNumericValueFilter(value, operation);
        return;
      }
    }

    // String filters — use startsWith for short values, contains for longer
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length === 0) return;
      const matchType = trimmed.length < 3 ? 'startsWith' : 'contains';
      whereClause[key] = { [matchType]: trimmed, mode: 'insensitive' };
      return;
    }

    // Direct match
    whereClause[key] = value;
  });

  return whereClause;
};

const generateNumericValueFilter = (operationObj: any, operation: string) => {
  switch (operation) {
    case 'gt':
      return { gte: operationObj[operation] };
    case 'lt':
      return { lte: operationObj[operation] };
    case 'btw':
      const [min, max] = operationObj[operation];
      return { AND: [{ gte: min }, { lte: max }] };
    default:
      return operationObj[operation];
  }
};
