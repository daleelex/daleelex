import React, { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProductsService } from './products.service';
import { Product } from '../../global/global.interfaces';
import { EToastType } from '../../global/global.enums';
import { showToast } from '../../utils/common-utils';
import './products.scss';

// ─── Types ────────────────────────────────────────────────────────────────────
type ProductStatus = 'Released' | 'In Development' | 'Code Freeze';

interface StatusConfig {
    className: string;
    icon: string;
}

const STATUS_MAP: Record<string, StatusConfig> = {
    'Released': { className: 'badge--success', icon: '●' },
    'In Development': { className: 'badge--info', icon: '◐' },
    'Code Freeze': { className: 'badge--warning', icon: '■' },
};

const DEFAULT_STATUS: StatusConfig = { className: 'badge--info', icon: '○' };

// ─── Product Card ─────────────────────────────────────────────────────────────
const ProductCard = memo<{ product: Product; index: number; onClick: (id: string) => void }>(
    ({ product, index, onClick }) => {
        const status = STATUS_MAP[product.status] || DEFAULT_STATUS;

        return (
            <div
                className="product-card"
                style={{ animationDelay: `${index * 40}ms` }}
                onClick={() => onClick(product.id)}
                role="button"
                tabIndex={0}
                aria-label={`${product.name} — ${product.status}`}
                onKeyDown={(e) => e.key === 'Enter' && onClick(product.id)}
            >
                <div className="product-card__content">
                    <div className="product-card__top">
                        <span className={`badge ${status.className}`}>
                            {status.icon} {product.status}
                        </span>
                    </div>
                    <h3 className="product-card__name">{product.name}</h3>
                    <span className="product-card__version">v{product.version}</span>
                </div>
                <div className="product-card__footer">
                    <span className="product-card__link">
                        View details
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    </span>
                </div>
            </div>
        );
    },
);
ProductCard.displayName = 'ProductCard';

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const ProductSkeleton = memo(() => (
    <div className="products-grid">
        {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton-card skeleton-card--product" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="skeleton-line skeleton-line--badge" />
                <div className="skeleton-line skeleton-line--title" />
                <div className="skeleton-line skeleton-line--sub" />
            </div>
        ))}
    </div>
));
ProductSkeleton.displayName = 'ProductSkeleton';

// ─── Empty State ──────────────────────────────────────────────────────────────
const EmptyState = memo(() => (
    <div className="empty-state">
        <div className="empty-state__icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
        </div>
        <p className="empty-state__text">No products found in the registry</p>
        <p className="empty-state__sub">Products will appear here once they are added to the system.</p>
    </div>
));
EmptyState.displayName = 'EmptyState';

// ─── Products Page ────────────────────────────────────────────────────────────
export const ProductsPage: React.FC = () => {
    const navigate = useNavigate();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        try {
            const result = await ProductsService.getAll({
                page: 1,
                limit: 50,
                sortBy: 'name',
                sort: 'asc',
            });

            if (result?.data) {
                setProducts(result.data);
                setTotal(result.meta?.total ?? result.data.length);
            } else {
                const arr = Array.isArray(result) ? result : [];
                setProducts(arr);
                setTotal(arr.length);
            }
        } catch (error) {
            console.error('Product fetch error:', error);
            showToast(EToastType.ERROR, 'Failed to synchronize with Product Registry.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const handleProductClick = useCallback(
        (id: string) => navigate(`/products/${id}`),
        [navigate],
    );

    return (
        <div className="products-page">
            <header className="products-page__topbar">
                <div>
                    <h1 className="products-page__title">Products</h1>
                    <p className="products-page__subtitle">
                        {total > 0 ? `${total} active assets` : 'No assets'} in the DaleelEx ecosystem
                    </p>
                </div>
            </header>

            {loading ? (
                <ProductSkeleton />
            ) : products.length === 0 ? (
                <EmptyState />
            ) : (
                <div className="products-grid">
                    {products.map((product, i) => (
                        <ProductCard
                            key={product.id}
                            product={product}
                            index={i}
                            onClick={handleProductClick}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};