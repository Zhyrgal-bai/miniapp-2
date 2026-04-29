import "../ui/Toast.css";

type ToastProps = {
  message: string;
  visible: boolean;
};

export default function Toast({ message, visible }: ToastProps) {
  if (!message) return null;

  return <div className={`toast${visible ? " show" : ""}`}>✅ {message}</div>;
}
