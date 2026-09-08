import { Modal } from "./Modal";

/** Kurzanleitung: wie Webdarts funktioniert (Raum eröffnen, beitreten, spielen). */
export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="So funktioniert DOCA Webdarts" onClose={onClose} wide>
      <div className="wd-help">
        <section>
          <h4>Worum geht's</h4>
          <p>
            Online-Darts für <strong>Doppel (2 gegen 2)</strong> oder Einzel – mit
            Kamera und Mikro für alle am Tisch und einem gemeinsamen Scorer. Das
            große Videobild zeigt immer den Spieler, der gerade am Wurf ist.
          </p>
        </section>

        <section>
          <h4>1. Raum eröffnen</h4>
          <p>
            Rechts unter <em>Räume</em>: optional einen Raumnamen eintragen,
            Spielart (<strong>X01</strong> oder <strong>Cricket</strong>) und
            <strong> Doppel/Einzel</strong> wählen. Wenn ihr nur zu dritt seid,
            kannst du einen <strong>Bot</strong> als Gegner auswählen (feste Stufe,
            PDC-Star oder eigener Average). Dann <em>Raum erstellen</em> – du bist
            damit Host des Raums.
          </p>
        </section>

        <section>
          <h4>2. Einem Raum beitreten</h4>
          <p>
            Offene Räume stehen rechts in der Liste. <em>Beitreten</em> setzt dich
            in den Raum, <em>Zuschauen</em> zeigt ein laufendes Spiel ohne
            mitzuspielen. Wer online ist, siehst du links – fahr mit der Maus über
            einen Namen für dessen Grundwerte (Average, Doppelquote, kürzestes Leg,
            höchstes Finish).
          </p>
        </section>

        <section>
          <h4>3. Plätze &amp; Teams</h4>
          <p>
            Im Raum auf einen freien Platz bei <strong>Team A</strong> oder
            <strong> Team B</strong> klicken. Spieler 1 eines Teams (Kapitän) darf
            den Teamnamen ändern. Der Host platziert bei Bedarf den Bot auf einem
            freien Platz und startet das Spiel, sobald alle Plätze besetzt sind.
          </p>
        </section>

        <section>
          <h4>4. Doppel: Beide an einem Board (1 Kamera)</h4>
          <p>
            Stehen zwei Partner zusammen an einem Board mit nur einem Gerät, in der
            Aufstellung beim Team <strong>„Beide an einem Board (1 Kamera)"</strong>
            anhaken. Dann setzt sich nur <strong>Spieler 1</strong> auf Platz 1
            (mit Kamera &amp; Mikro) und trägt auf <strong>Platz 2</strong> den
            <strong> Partner</strong> ein – DOCA-Mitglied aus der Liste (dann zählt
            auch dessen Statistik mit) oder einfach ein Name. Spieler 1 wertet für
            beide; wer dran ist, zeigt der Scorer. Im Video bleiben es
            <strong> vier Kacheln</strong> – die Partner-Kachel (📍) zeigt dasselbe
            Bild wie Platz 1, das große Bild wechselt normal weiter.
          </p>
        </section>

        <section>
          <h4>5. Kamera &amp; Mikro</h4>
          <p>
            Beim ersten Betreten fragt der Browser nach Kamera- und
            Mikrofonfreigabe – <strong>erlauben</strong>. Jede Kamera kann nur von
            einem Programm/Tab gleichzeitig benutzt werden. Über
            <em> „🔊 Ton aktivieren"</em> schaltest du den Ton der anderen frei
            (nötig v. a. auf iPhone/iPad).
          </p>
        </section>

        <section>
          <h4>6. Ausbullen</h4>
          <p>
            Vor dem ersten Leg wird ausgebullt: jedes Team wirft
            <strong> 3 Darts</strong>. Es zählt die Reihenfolge (Bulls-Eye vor
            Bull vor daneben) – bei exakt gleichem Ergebnis wird nachgeworfen.
          </p>
        </section>

        <section>
          <h4>7. Werten</h4>
          <p>
            Eingeben darf nur der Spieler, der gerade am Wurf ist – für alle
            anderen ist das Feld gesperrt. Das Aufnahme-Ergebnis wird per Tastatur
            oder über den Ziffernblock eingegeben; beim Checkout kommt die
            Doppel-Abfrage automatisch.
          </p>
        </section>

        <section>
          <h4>8. Pause &amp; Revanche</h4>
          <p>
            Muss jemand kurz weg (WC, Telefon), drückt ein Spieler am Tisch
            <em> Pause</em>; fortsetzen kann danach jeder am Tisch. Fällt jemand
            aus der Verbindung, pausiert das Spiel automatisch. Nach dem Match
            könnt ihr eine <strong>Revanche</strong> anbieten – stimmen die Gegner
            zu, geht's sofort weiter, sonst zurück in die Lobby.
          </p>
        </section>
      </div>

      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button className="primary" onClick={onClose}>
          Verstanden
        </button>
      </div>
    </Modal>
  );
}
