import { Modal } from "./Modal";

/**
 * Rückfrage nach einem Doppel-Checkout in einem Bereich, wo Bull (D25=50)
 * rechnerisch der Finish-Dart gewesen sein könnte: aus der Endsumme allein
 * lässt sich "war das genau Bull" nicht zuverlässig ableiten (die meisten
 * Checkouts laufen über die Endsummen-Eingabe, nicht Dart für Dart). Für die
 * 3K-Bestleistung "Bullfinish" fragen wir deshalb einmal gezielt nach –
 * nur wenn Bull bei diesem Wert/dieser Dartzahl überhaupt möglich wäre.
 */
export function BullFinishDialog({
  score,
  onAnswer,
}: {
  score: number;
  onAnswer: (bullFinish: boolean) => void;
}) {
  return (
    <Modal title={`Checkout ${score}`} onClose={() => onAnswer(false)}>
      <div className="field">
        <span className="lbl">War das ein Bullfinish (letzter Dart auf Bull)?</span>
        <div className="row" style={{ gap: 8 }}>
          <button className="primary" onClick={() => onAnswer(true)}>
            Ja
          </button>
          <button className="ghost" onClick={() => onAnswer(false)}>
            Nein
          </button>
        </div>
      </div>
    </Modal>
  );
}
