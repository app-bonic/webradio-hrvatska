# 📻 WEB RADIO HRVATSKA

Retro auto radio — slušaj hrvatske radio postaje uživo iz kabine starog auta. 🚗🌙

**195 hrvatskih radio postaja** s provjerenim streamovima, u dizajnu retro automobilske komandne ploče: drvena ploča, kromirani radio "app.bonic DeLux", skala s kazaljkom, VU metar, noćna vožnja kroz vjetrobran.

## Značajke

- 🎬 **Video vožnja u vjetrobranu** — YouTube vožnje (samo DRIVE 4K, kadar poravnat na donji rub) s kanala [City Drive 4K](https://www.youtube.com/@citydrive4K), s jasno navedenim izvorom i naslovom (klik na pločicu otvara video na YouTubeu). Retro **poluga** mijenja vožnju, prekidač VIDEO/ANIM vraća crtanu animaciju. Video je mutiran — zvuk dolazi s radija. Uvršteni su samo videi kojima je embedanje dopušteno.

- 🎛️ **Retro radio** — skala 87.5–108 MHz s animiranom kazaljkom, LCD zaslon, VU metar
- 🔊 **VOL gumb** — povuci mišem ili kotačić za glasnoću
- 🎚️ **TUNE gumb** — klik lijevo/desno = prethodna/sljedeća postaja
- 💾 **6 preseta** — drži tipku za spremanje trenutne postaje, klik za pozivanje
- 🔍 **Pretraga i filtri** — po nazivu, gradu i žanru
- 🔄 **Automatski fallback** — ako stream ne radi, proba se sljedeći
- 📱 **Responzivno** — radi i na mobitelu; Media Session (kontrole na zaključanom ekranu)
- 💾 Zadnja postaja, glasnoća i preseti pamte se u pregledniku

## Deploy na GitHub Pages

1. Napravi novi repozitorij na GitHubu (npr. `webradio-hrvatska`)
2. Pushaj sadržaj ove mape
3. **Settings → Pages → Source: Deploy from a branch → main / root**
4. Stranica će biti na `https://<korisnik>.github.io/webradio-hrvatska/`

Nema builda — čisti HTML/CSS/JS, sve radi odmah.

## Izvor podataka

Popis postaja skrejpan sa: radiostanica.com, radio-stanice-uzivo.com (+ popis s radio-hrvatska.com za provjeru pokrivenosti). Svi streamovi provjereni; zadržani samo HTTPS streamovi (GitHub Pages je HTTPS pa `http://` streamovi ne bi radili — mixed content).

Datoteke:
- `index.html` — struktura scene (vjetrobran, ploča, radio, pretinac s postajama)
- `style.css` — sav retro dizajn
- `app.js` — logika reprodukcije, preseti, filtri
- `stations.js` — podaci o postajama (auto-generirano)
