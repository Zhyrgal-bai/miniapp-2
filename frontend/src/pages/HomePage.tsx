import { useEffect, useMemo, useState } from "react";
import { api, apiAbsoluteUrl } from "../services/api";
import { fetchMyOrders } from "../services/myOrdersApi";
import type { Category, Product } from "../types";
import ProductGrid from "../components/product/ProductGrid";
import ProductDetailModal from "../components/product/ProductDetailModal";
import Toast from "../components/ui/Toast";
import { getWebAppUserId } from "../utils/telegramUserId";
import { buildCatalogRequestParams } from "../utils/storeParams";
import { categoryRoots } from "../utils/categoryTree";
import { APP_NAME, FIRST_ORDER_PROMO } from "../config/brand";
import "../components/ui/HomePage.css";

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [toast, setToast] = useState("");
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState("ВСЕ");
  const [categoryTree, setCategoryTree] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFirstOrderBanner, setShowFirstOrderBanner] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setIsToastVisible(true);
    setTimeout(() => {
      setIsToastVisible(false);
      setToast("");
    }, 2000);
  };

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const params = buildCatalogRequestParams();
        if (!params.shop && !params.userId) {
          setProducts([]);
          return;
        }
        const res = await api.get("/products", { params });
        setProducts(res.data || []);
      } catch (e) {
        console.log(e);
        setProducts([]);
      }
    };

    fetchProducts();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const params = buildCatalogRequestParams();
        if (!params.shop && !params.userId) {
          setCategoryTree([]);
          return;
        }
        const res = await api.get<Category[]>(apiAbsoluteUrl("/categories"), {
          params,
        });
        setCategoryTree(Array.isArray(res.data) ? res.data : []);
      } catch {
        setCategoryTree([]);
      }
    })();
  }, []);

  useEffect(() => {
    const uid = getWebAppUserId();
    if (!Number.isFinite(uid) || uid <= 0) {
      setShowFirstOrderBanner(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchMyOrders(uid);
        if (!cancelled) {
          setShowFirstOrderBanner(rows.length === 0);
        }
      } catch {
        if (!cancelled) {
          setShowFirstOrderBanner(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const copyPromoCode = async () => {
    try {
      await navigator.clipboard.writeText(FIRST_ORDER_PROMO);
      showToast("Промокод скопирован");
    } catch {
      showToast(`Промокод: ${FIRST_ORDER_PROMO}`);
    }
  };

  const categoryFilterRoots = useMemo(
    () => categoryRoots(categoryTree),
    [categoryTree]
  );

  const categories = useMemo(
    () => [
      "ВСЕ",
      "НОВИНКИ",
      "ПОПУЛЯРНОЕ",
      "СКИДКИ",
      ...categoryFilterRoots.map((c) => c.name.toUpperCase()),
    ],
    [categoryFilterRoots]
  );

  const filteredProducts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return products.filter((p) => {
      const parentName = p.category?.parent?.name?.toUpperCase() ?? "";
      const categoryMatch =
        activeCategory === "ВСЕ" ||
        (activeCategory === "НОВИНКИ" && p.isNew === true) ||
        (activeCategory === "ПОПУЛЯРНОЕ" && p.isPopular === true) ||
        (activeCategory === "СКИДКИ" && p.isSale === true) ||
        parentName === activeCategory;
      const searchMatch = p.name.toLowerCase().includes(normalizedQuery);
      return categoryMatch && searchMatch;
    });
  }, [activeCategory, products, searchQuery]);

  return (
    <div className="home-page">
      {showFirstOrderBanner && (
        <div className="home-discount-banner">
          <div className="home-discount-banner__text">
            <span className="home-discount-banner__title">
              🎁 -10% на первый заказ
            </span>
            <span className="home-discount-banner__promo">
              Промокод: <strong>{FIRST_ORDER_PROMO}</strong>
            </span>
          </div>
          <button
            type="button"
            className="home-discount-banner__copy"
            onClick={() => void copyPromoCode()}
          >
            Копировать
          </button>
        </div>
      )}
      {/* Premium minimal hero section */}
      <section className="hero">
        <h1 className="hero-title">{APP_NAME}</h1>
        <p className="hero-subtitle">одежда</p>
      </section>
      <div className="hero-bottom-spacer" />
      <input
        type="text"
        placeholder="Поиск одежды..."
        className="search-input"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <div className="categories">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={activeCategory === cat ? "active" : ""}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>
      <ProductGrid
        products={filteredProducts}
        catalogProductCount={products.length}
        showToast={showToast}
        onProductSelect={setSelectedProduct}
      />
      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
      <Toast message={toast} visible={isToastVisible} />
    </div>
  );
}