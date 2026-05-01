import { useEffect, useMemo, useState } from "react";
import { api, apiAbsoluteUrl } from "../services/api";
import type { Category, Product } from "../types";
import ProductGrid from "../components/product/ProductGrid";
import ProductDetailModal from "../components/product/ProductDetailModal";
import Toast from "../components/ui/Toast";
import { useShop } from "../context/ShopContext";
import { buildCatalogRequestParams } from "../utils/storeParams";
import { categoryRoots } from "../utils/categoryTree";
import { APP_NAME } from "../config/brand";
import { useTheme } from "../context/ThemeContext";
import "../components/ui/HomePage.css";

export default function HomePage() {
  const { businessId } = useShop();
  const { theme } = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [toast, setToast] = useState("");
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState("ВСЕ");
  const [categoryTree, setCategoryTree] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
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
      if (businessId == null) {
        setProducts([]);
        return;
      }
      try {
        const params = buildCatalogRequestParams();
        const res = await api.get("/products", { params });
        setProducts(res.data || []);
      } catch (e) {
        console.log(e);
        setProducts([]);
      }
    };

    void fetchProducts();
  }, [businessId]);

  useEffect(() => {
    void (async () => {
      if (businessId == null) {
        setCategoryTree([]);
        return;
      }
      try {
        const params = buildCatalogRequestParams();
        const res = await api.get<Category[]>(apiAbsoluteUrl("/categories"), {
          params,
        });
        setCategoryTree(Array.isArray(res.data) ? res.data : []);
      } catch {
        setCategoryTree([]);
      }
    })();
  }, [businessId]);

  const copyPromoCode = async () => {
    const line = theme.banner.subtitle.trim() || theme.banner.title;
    try {
      await navigator.clipboard.writeText(line);
      showToast("Скопировано");
    } catch {
      showToast(line);
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

  const layoutClass =
    theme.layout === "modern"
      ? "home-page home-page--modern"
      : "home-page home-page--classic";

  return (
    <div className={layoutClass}>
      {theme.banner.enabled && (
        <div
          className="home-discount-banner"
          style={{
            backgroundColor: theme.cardColor,
            color: theme.textColor,
            border: `1px solid ${theme.primaryColor}33`,
          }}
        >
          <div className="home-discount-banner__text">
            <span className="home-discount-banner__title">
              {theme.banner.title}
            </span>
            <span className="home-discount-banner__promo">
              {theme.banner.subtitle}
            </span>
          </div>
          <button
            type="button"
            className="home-discount-banner__copy"
            style={{ backgroundColor: theme.primaryColor, color: "#fff" }}
            onClick={() => void copyPromoCode()}
          >
            Копировать
          </button>
        </div>
      )}
      {/* Premium minimal hero section */}
      <section className="hero">
        {theme.logoUrl ? (
          <img
            src={theme.logoUrl}
            alt=""
            className="hero-logo"
            style={{ maxHeight: 48, marginBottom: 8 }}
          />
        ) : null}
        <h1 className="hero-title" style={{ color: theme.textColor }}>
          {APP_NAME}
        </h1>
        <p className="hero-subtitle" style={{ color: theme.textColor }}>
          одежда
        </p>
      </section>
      <div className="hero-bottom-spacer" />
      <input
        type="text"
        placeholder="Поиск одежды..."
        className="search-input"
        style={{
          backgroundColor: theme.cardColor,
          color: theme.textColor,
          borderColor: `${theme.primaryColor}44`,
        }}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <div className="categories">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={activeCategory === cat ? "active" : ""}
            style={
              activeCategory === cat
                ? {
                    backgroundColor: theme.primaryColor,
                    color: "#fff",
                    borderColor: theme.primaryColor,
                  }
                : {
                    backgroundColor: "transparent",
                    color: theme.textColor,
                    borderColor: `${theme.textColor}33`,
                  }
            }
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