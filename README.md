# Signalo — landing page

« Je signale → l'IA analyse → la mairie agit → le problème est résolu. »

Une page, douze chapitres. Les trois premiers se jouent sur une scène 3D en verre
(Three.js) pilotée par le scroll ; les neuf suivants sont des sections classiques,
responsive, qui défilent par-dessus.

| # | Chapitre | Où |
|---|---|---|
| 01 | Hero — Signaler. Améliorer. Votre ville. | `#slide-1` (scène 3D) |
| 02 | Le problème — l'objet éclate en fragments | `#slide-2` (scène 3D) |
| 03 | La solution — l'objet se recompose | `#slide-3` (scène 3D) |
| 04 | Signalo Citoyen (vert) | `#citoyen` |
| 05 | L'IA — 100 % IA | `#ia` |
| 06 | Signalo Mairie (rouge) | `#mairie` |
| 07 | Le workflow | `#workflow` |
| 08 | La résolution (avant / après) | `#resolution` |
| 09 | L'écosystème | `#ecosysteme` |
| 10 | 100 % IA — manifeste | `#manifeste` |
| 11 | Versions futures | `#versions` |
| 12 | Passer à l'action + demande de démo mairie | `#contact` |

## Ouvrir

```sh
python serve.py
```

Puis <http://127.0.0.1:8000>. `version-monofichier.html` contient tout le site dans un
seul fichier et s'ouvre directement ; régénérez-le après chaque modification :

```sh
python build_monofichier.py
```

## Modifier

| Quoi | Où |
|---|---|
| Textes de toutes les sections | `index.html` |
| Mise en page des sections, couleurs (`--green`, `--red`) | `css/signalo.css` |
| Header, curseur, formulaire, préchargeur | `css/styles.css` |
| Menu, rail de progression, animations des sections | `js/story.js` |
| Scène 3D, cadrage, envoi du formulaire | `js/app.js` |
| Liens App Store / Google Play | `index.html`, liens `data-store` (actuellement `#`) |
| Adresse e-mail de contact | `index.html`, attribut `data-email` du formulaire et lien `mailto:` |
| Serveur qui reçoit les demandes de démo | `js/app.js`, constante `DEMO_ENDPOINT` |

Tant que `DEMO_ENDPOINT` est vide, le formulaire ouvre la messagerie du visiteur avec
la demande rédigée. Renseignez l'adresse de votre API : la demande y sera envoyée en
JSON (mêmes champs que l'ancien site), avec la messagerie en secours en cas d'échec.

## Vidéos (Higgsfield.ai ou autres)

Le site n'affiche aucune vidéo pour l'instant : aucune image ou faux effet ne les
remplace. Pour en ajouter une dans une section, placez-la dans un cadre à elle, jamais
sous du texte :

```html
<figure class="media-frame">
  <video data-src="./assets/video/citoyen.mp4" muted loop playsinline preload="none"
         poster="./assets/video/citoyen.jpg"></video>
</figure>
```

`js/story.js` charge la vidéo seulement à l'approche, la lit quand elle est visible et
la met en pause sinon. Exportez en MP4 (H.264), 1080p au plus, 4 à 8 Mo, sans son.

## Vérifier la mise en page

`tools/layout-audit.js` détecte les textes qui se chevauchent, passent sous l'objet 3D,
sous le header, hors écran ou rognés, et le défilement horizontal. Dans la console du
navigateur, sur le site local, à chaque taille d'écran :

```js
const { audit } = await import('./tools/layout-audit.js'); console.table(await audit());
```

Une liste vide signifie qu'aucun problème n'a été trouvé.

## Contenu

```text
index.html                 Structure et textes des douze chapitres
css/styles.css             Moteur : header, curseur, titres animés, formulaire, préchargeur
css/signalo.css            Landing page : chapitres 01–12, responsive
css/fonts.css              Space Grotesk
js/app.js                  Scène 3D, verre, scroll, formulaire de démo
js/story.js                Navigation, rail, apparitions, scènes des sections
assets/shapes/shape.svg    Le symbole Signalo en verre
assets/brand/mark.svg      Le logo du header
tools/                     Générateur de formes, aperçu, audit de mise en page
vendor/                    Three.js r160 et SVGLoader
licenses/                  Licences Three.js et Space Grotesk
```
