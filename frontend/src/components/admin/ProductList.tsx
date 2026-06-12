import { showErrorToast } from "../../store/toast.store";
import { useEffect } from "react";
import { useAdminStore } from "../../store/admin.store";
import { formatAdminApiError } from "../../utils/adminApiError";
import { getPrimaryImage, getTotalStockSum } from "../../utils/product";

const ProductList = () => {
  const { products, fetchProducts, deleteProduct } = useAdminStore();

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

  return (
    <div className="admin-products">
      {products.length === 0 && (
        <div className="admin-empty-products">Пока нет товаров</div>
      )}

      {products.map((p) => {
        const totalStock = getTotalStockSum(p);
        return (
          <div key={p.id} className="admin-product-card">
            <img
              src={getPrimaryImage(p)}
              alt={p.name}
              className="admin-product-image"
            />

            <div className="info">
              <h3 className="admin-product-name">{p.name}</h3>
              <p className="admin-product-meta">{p.price} сом</p>
              <div className="stats">
                <span>Продано: {p.sold ?? 0}</span>
                <span>Осталось: {totalStock}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={async () => {
                try {
                  await deleteProduct(p.id!);
                } catch (e) {
                  showErrorToast(formatAdminApiError(e));
                }
              }}
              className="delete"
            >
              В архив
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ProductList;