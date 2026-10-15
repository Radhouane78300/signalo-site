// Demandes commerciales — envoi des formulaires « Demander une démonstration » et
// « Contact et prise de rendez-vous » à l'API RedJam, qui les enregistre dans sa
// base de données (module CRM « Demandes commerciales »).
//
// Adresse de l'API : balise <meta name="signalo-api" content="…"> de la page, sinon
// https://api.redjam-signalo.com. Aucun secret ici : l'API publique ne fait
// qu'enregistrer une demande et lister les créneaux libres.

export function apiBase() {
    const meta = document.querySelector('meta[name="signalo-api"]');
    return (meta?.content || 'https://api.redjam-signalo.com').replace(/\/+$/, '');
}

// Clé d'une soumission : une même demande renvoyée (double clic, nouvel essai après une
// coupure) n'est enregistrée qu'une fois. Renouvelée après un envoi réussi.
export function nouvelleCle() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID().replace(/-/g, '');
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

export class ErreurEnvoi extends Error {
    constructor(message, { champs = null, code = null, statut = 0 } = {}) {
        super(message);
        this.champs = champs;
        this.code = code;
        this.statut = statut;
    }
}

const MSG_RESEAU = 'Impossible de joindre le serveur. Vérifiez votre connexion internet puis réessayez : vos informations sont conservées.';

async function appel(chemin, options = {}) {
    let reponse;
    try {
        reponse = await fetch(`${apiBase()}${chemin}`, {
            ...options,
            headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
        });
    } catch (e) {
        throw new ErreurEnvoi(MSG_RESEAU, { code: 'RESEAU' });
    }
    let corps = null;
    try { corps = await reponse.json(); } catch (e) { /* réponse non JSON */ }
    if (!reponse.ok || !corps || corps.success !== true) {
        const err = corps?.error;
        throw new ErreurEnvoi(err?.message || `Le serveur n'a pas pu enregistrer la demande (erreur ${reponse.status}). Merci de réessayer.`, { champs: err?.champs || null, code: err?.code || null, statut: reponse.status });
    }
    return corps.data;
}

export const envoyerDemonstration = (donnees) => appel('/demandes-commerciales/demonstration', { method: 'POST', body: JSON.stringify(donnees) });
export const envoyerContact = (donnees) => appel('/demandes-commerciales/contact', { method: 'POST', body: JSON.stringify(donnees) });
export const chargerAgenda = () => appel('/demandes-commerciales/agenda');

// Erreurs affichées près des champs concernés (attribut data-champ sur le conteneur).
export function afficherErreursChamps(form, champs) {
    effacerErreursChamps(form);
    let premier = null;
    for (const [nom, message] of Object.entries(champs || {})) {
        const zone = form.querySelector(`[data-champ="${nom}"]`);
        if (!zone) continue;
        zone.classList.add('a-erreur');
        const msg = zone.querySelector('.erreur-champ');
        if (msg) msg.textContent = message;
        const saisie = zone.querySelector('input, select, textarea');
        if (saisie) {
            saisie.setAttribute('aria-invalid', 'true');
            premier ??= saisie;
        }
    }
    premier?.focus();
    return Boolean(premier);
}

export function effacerErreursChamps(form) {
    form.querySelectorAll('.a-erreur').forEach((z) => z.classList.remove('a-erreur'));
    form.querySelectorAll('.erreur-champ').forEach((m) => { m.textContent = ''; });
    form.querySelectorAll('[aria-invalid]').forEach((s) => s.removeAttribute('aria-invalid'));
}

// Contrôle avant envoi (le serveur revérifie tout) : mêmes règles, mêmes messages.
export function controlerChamps(form, regles) {
    const champs = {};
    for (const [nom, regle] of Object.entries(regles)) {
        const el = form.elements[nom];
        const valeur = el?.type === 'checkbox' ? el.checked : String(el?.value || '').trim();
        const message = regle(valeur);
        if (message) champs[nom] = message;
    }
    return champs;
}

export const regles = {
    obligatoire: (libelle) => (v) => (v ? null : `${libelle} est obligatoire.`),
    email: (v) => (!v ? "L'adresse e-mail est obligatoire." : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? null : 'Adresse e-mail invalide.'),
    telephone: (v) => {
        if (!v) return 'Le téléphone est obligatoire.';
        const chiffres = v.replace(/\D/g, '').length;
        return /^\+?[0-9 ().-]{6,25}$/.test(v) && chiffres >= 9 && chiffres <= 15 ? null : 'Numéro de téléphone invalide.';
    },
    confidentialite: (v) => (v ? null : 'Merci de confirmer avoir lu la politique de confidentialité.'),
};

// Autocomplétion des communes françaises (API officielle geo.api.gouv.fr) : renseigne le
// code INSEE, utilisé par le CRM pour rattacher la demande à la bonne commune.
export function autocompletionCommune(input, liste, surChoix) {
    let minuterie = 0, requete = 0, elements = [], actif = -1;
    const masquer = () => {
        liste.hidden = true; liste.innerHTML = ''; elements = []; actif = -1;
        input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant');
    };
    const choisir = (c) => { input.value = c.nom; surChoix(c); masquer(); };
    const afficher = (communes) => {
        masquer();
        // Réponse arrivée après que le visiteur a quitté le champ : rien à afficher.
        if (!communes.length || document.activeElement !== input) return;
        elements = communes;
        communes.forEach((c, i) => {
            const li = document.createElement('li');
            li.id = `${liste.id}-${i}`;
            li.setAttribute('role', 'option');
            const nom = document.createElement('strong');
            nom.textContent = c.nom;
            const meta = document.createElement('span');
            meta.textContent = [c.codesPostaux?.[0], c.departement?.nom].filter(Boolean).join(' · ');
            li.append(nom, meta);
            li.addEventListener('mousedown', (e) => { e.preventDefault(); choisir(c); });
            liste.appendChild(li);
        });
        liste.hidden = false;
        input.setAttribute('aria-expanded', 'true');
    };
    input.addEventListener('input', () => {
        surChoix(null);
        clearTimeout(minuterie);
        const texte = input.value.trim();
        if (texte.length < 2) { requete++; masquer(); return; }
        minuterie = setTimeout(() => {
            const ticket = ++requete;
            fetch(`https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(texte)}&boost=population&limit=7&fields=nom,code,codesPostaux,departement`)
                .then((r) => (r.ok ? r.json() : []))
                .then((d) => { if (ticket === requete) afficher(Array.isArray(d) ? d : []); })
                .catch(() => { if (ticket === requete) masquer(); });
        }, 250);
    });
    input.addEventListener('keydown', (e) => {
        if (liste.hidden || !elements.length) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            actif = e.key === 'ArrowDown' ? Math.min(actif + 1, elements.length - 1) : Math.max(actif - 1, 0);
            [...liste.children].forEach((li, i) => li.classList.toggle('actif', i === actif));
            input.setAttribute('aria-activedescendant', `${liste.id}-${actif}`);
        } else if (e.key === 'Enter' && actif >= 0) {
            e.preventDefault();
            choisir(elements[actif]);
        } else if (e.key === 'Escape') {
            masquer();
        }
    });
    input.addEventListener('blur', () => setTimeout(masquer, 120));
}
