🧪 Übersicht aller Tests

✅ Prozesspfade

- (T-1)PZ-1: Vertrag ist nur bei Vertragserfüllung erfolgreich
- (T-2)PZ-2: Vertrag ist bei Lieferung erfolgreich

🔒 Zugangskontrollen

- (T-3): Nicht-Gegenpartei darf Vertrag nicht bestätigen
- (T-4): Nicht-Ersteller darf Lieferung nicht bestätigen
- (T-5): Nicht-Oracle darf keine Lieferinformationen senden
- (T-6): Zweites Setzen des Oracles ist verboten
- (T-7): Nicht-Gegenpartei darf keine Sendungsnummer setzen
- (T-8): Nicht-Gegenpartei darf keine Beträge abheben
  
🔁 Zustandsübergänge

- (T-9): Auszahlung vor Freigabe ist verboten
- (T-10): Hash-Mismatch, wenn Oracle falschen Tracking-Hash bereitstellt
- (T-11): Zweite Auszahlung am gleichen Vertrag ist verweigert
- (T-12): Deaktivieren vor Status "Completed" ist blockiert
- (T-13): Doppeltes Bestätigen von Verträgen ist verboten
- (T-14): Abschlussbestätigung nicht erlaubt, wenn Lieferung gesetzt ist
- (T-15): Setzen der Sendungsnummer darf nur einmal erfolgen
- (T-16): Freigabe der Lieferung ohne Oracle-Bestätigung verboten

🔐 Sicherheit: Reentrancy

- (T-17): Reentrancy-Angriffe werden blockiert

🧨 Edge Cases

- (T-18): 0-Adresse ist verboten
- (T-19): ETH-Mismatch zwischen msg.value und Parameter ist verboten
- (T-20): Vertragserstellung mit 0 ETH ist erlaubt, wenn Betrag 0 ist
- (T-21): Auszahlung durch Dritte ist verboten
- (T-22): Auszahlung mit 0 auszahlbarem Betrag scheitert
- (T-23): Deaktivieren nach Status "Completed" ist erlaubt

⛽️ Gasverbrauch (nur Vergleich, keine Assertions)

- Deployment & Vertragsabschluss (ohne Lieferung)
- Deployment & Vertragsabschluss (mit Lieferung)
