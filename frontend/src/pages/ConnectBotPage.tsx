import { useState } from "react";
import { postConnectBot } from "../services/admin.service";
import "../components/ui/FAQPage.css";
import "./ConnectBotPage.css";

export default function ConnectBotPage() {
  const [botToken, setBotToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{
    shopId: number;
    botUsername: string;
  } | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setDone(null);
    const t = botToken.trim();
    if (!t) {
      setErr("Вставьте токен");
      return;
    }
    setSaving(true);
    try {
      const res = await postConnectBot(t);
      setDone({ shopId: res.shopId, botUsername: res.botUsername });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="faq faq-page connect-bot-page">
      <h1 className="faq-page__title">🤖 Подключить бота</h1>
      <p className="connect-bot-page__lead">
        Создайте бота в @BotFather, вставьте токен сюда — в команде <code className="connect-bot-page__code">/start</code> покупатели увидят
        кнопку «Открыть» с вашим магазином.
      </p>

      {done && (
        <div className="connect-bot-page__ok" role="status">
          <p>Бот подключён. Магазин: <strong>id {done.shopId}</strong></p>
          {done.botUsername ? (
            <p>
              <a
                className="connect-bot-page__link"
                href={`https://t.me/${done.botUsername}`}
                target="_blank"
                rel="noreferrer"
              >
                t.me/{done.botUsername}
              </a>
            </p>
          ) : null}
        </div>
      )}

      <form onSubmit={onSubmit} className="connect-bot-page__form">
        <label className="connect-bot-page__label" htmlFor="bot-token">
          Токен бота
        </label>
        <input
          id="bot-token"
          className="connect-bot-page__input"
          type="password"
          name="botToken"
          autoComplete="off"
          placeholder="Вставь токен бота"
          value={botToken}
          onChange={(e) => setBotToken(e.target.value)}
        />
        {err && <p className="connect-bot-page__err">{err}</p>}
        <button className="connect-bot-page__submit" type="submit" disabled={saving}>
          {saving ? "Сохраняем…" : "Сохранить и зарегистрировать"}
        </button>
      </form>
    </div>
  );
}
