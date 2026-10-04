import { MessageCircle, Send } from "lucide-react";

const TELEGRAM_URL = "https://t.me/Klrem1_bot?start=site";
const WHATSAPP_URL = "https://wa.me/79779480672?text=%D0%97%D0%B4%D1%80%D0%B0%D0%B2%D1%81%D1%82%D0%B2%D1%83%D0%B9%D1%82%D0%B5%21%20%D0%A5%D0%BE%D1%87%D1%83%20%D0%BE%D0%B1%D1%81%D1%83%D0%B4%D0%B8%D1%82%D1%8C%20%D1%80%D0%B5%D0%BC%D0%BE%D0%BD%D1%82%20%D0%BA%D0%B2%D0%B0%D1%80%D1%82%D0%B8%D1%80%D1%8B.";

export { TELEGRAM_URL, WHATSAPP_URL };

export function MessengerQuickActions() {
  return (
    <aside className="messenger-quick-actions" aria-label="Быстрая связь">
      <span className="messenger-quick-label">Напишите нам</span>
      <div className="messengers">
        <a href={TELEGRAM_URL} target="_blank" rel="noreferrer" aria-label="Написать в Telegram" className="telegram"><Send size={19} /><span>Telegram</span></a>
        <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" aria-label="Написать в WhatsApp" className="whatsapp"><MessageCircle size={20} /><span>WhatsApp</span></a>
      </div>
    </aside>
  );
}
