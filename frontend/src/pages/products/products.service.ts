import { api } from '../../providers/api-client';

// ─── Service ──────────────────────────────────────────────────────────────────
export const ProductsService = {
  async getAll(params: any) {
    const { data } = await api.get('/products', { params });
    return data.result ?? data;
  },

  async getOne(id: string) {
    const { data } = await api.get(`/products/${id}`);
    return data.result ?? data;
  },

  async create(payload: any) {
    const { data } = await api.post('/products', payload);
    return data;
  },

  async update(id: string, payload: any) {
    const { data } = await api.patch(`/products/${id}`, payload);
    return data;
  },

  async delete(id: string) {
    const { data } = await api.delete(`/products/${id}`);
    return data;
  },
};
