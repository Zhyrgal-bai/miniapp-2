import { useMemo } from "react";
import type { Category } from "../../types";
import { categorySelectGroups } from "../../utils/categoryTree";

type Props = {
  categories: Category[];
  value: number | string;
  onChange: (categoryId: number | null) => void;
  className?: string;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  placeholder?: string;
  placeholderValue?: string;
};

export function AdminCategorySelect(props: Props): React.ReactElement {
  const groups = useMemo(() => categorySelectGroups(props.categories), [props.categories]);
  const placeholderValue = props.placeholderValue ?? "";
  const showPlaceholder = props.placeholder != null && props.placeholder !== "";

  return (
    <select
      id={props.id}
      className={props.className}
      value={props.value}
      disabled={props.disabled}
      aria-label={props["aria-label"]}
      onChange={(e) => {
        const raw = e.target.value;
        if (showPlaceholder && raw === placeholderValue) {
          props.onChange(null);
          return;
        }
        const v = Number(raw);
        if (Number.isFinite(v)) props.onChange(v);
      }}
    >
      {showPlaceholder ? (
        <option value={placeholderValue}>{props.placeholder}</option>
      ) : null}
      {groups.map((group) => (
        <optgroup key={group.rootId} label={group.rootName}>
          {group.options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
