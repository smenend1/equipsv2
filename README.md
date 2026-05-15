# Assistència Bàsquet PWA - Multi Entitat

Versió amb suport per guardar diverses entitats i diversos equips per entitat.

## Funcionament

1. Afegeix una o més entitats.
2. Escull una entitat.
3. Afegeix un o més equips dins d'aquesta entitat.
4. Obre assistència.
5. Importa CSV de jugadors.
6. Els canvis es sincronitzen en temps real amb Firebase.

## Important

Les entitats i equips guardats al selector es desen al LocalStorage del dispositiu.
Això vol dir que cada mòbil pot guardar la seva llista d'accessos ràpids.

Les dades reals de jugadors i assistències es desen a Firestore.

## CSV d'exemple

```csv
Nom,Dorsal
"Martínez, Àlex",7
Núria López,12
João Silva,23
Laia Garcia,31
```

## Rutes Firestore

```txt
entitats/{entityId}/equips/{teamId}/jugadors/{playerId}
assistencies/{entityId}/dies/{date}/registres/{playerId}
assistencies/{entityId}/dies/{date}/meta/_meta
```


## Escuts d'entitat

Aquesta versió permet assignar un escut o imatge a cada entitat des del selector principal.

- L'escut es guarda al LocalStorage del dispositiu.
- No ocupa Firestore.
- No se sincronitza automàticament entre mòbils.
- Si vols el mateix escut a tots els mòbils, cal assignar-lo una vegada a cada dispositiu.
- S'accepten imatges PNG, JPG, WebP i SVG.
- Les imatges PNG/JPG/WebP es redimensionen automàticament abans de desar-se.


## Resum mensual

Aquesta versió afegeix una pantalla de **Resum mensual** des de la pantalla d'assistència.

Permet:

- Escollir el mes.
- Calcular per jugador:
  - Presents
  - Absents
  - Justificats
  - Total de registres
- Exportar el resum a CSV.

El resum mensual llegeix les assistències de totes les dates del mes a Firestore. No canvia l'estructura de dades existent.


## Versió corregida: selector de tipus de dia visible

Aquesta versió mostra clarament el selector **Tipus de dia** a la pantalla d'assistència, entre el botó d'importar CSV i els botons de resum/tancament.

Opcions:

- Entrenament
- Partit
- Altres

El resum mensual inclou una taula amb els dies registrats del mes i el tipus corresponent.
